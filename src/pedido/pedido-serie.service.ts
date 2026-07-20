import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';
import { Pedido } from './entities/pedido.entity';
import { PedidoItemConfig } from './entities/pedido-item-config.entity';
import {
  PedidoItemSerie,
  PedidoItemSerieEstado,
} from './entities/pedido-item-serie.entity';
import { StkNumeroSerie } from './entities/stk-numero-serie.entity';
import { VtaSerieItem } from './entities/vta-serie-item.entity';
import { PedidoItem } from './entities/pedido-item.entity';

const ESTADOS_ACTIVOS = [
  PedidoItemSerieEstado.RESERVADA,
  PedidoItemSerieEstado.CONFIRMANDO,
  PedidoItemSerieEstado.CONFIRMADA,
];
const ESTADOS_RESERVA = [
  PedidoItemSerieEstado.RESERVADA,
  PedidoItemSerieEstado.CONFIRMANDO,
];

@Injectable()
export class PedidoSerieService {
  private readonly logger = new Logger(PedidoSerieService.name);

  constructor(
    @InjectRepository(PedidoItemConfig, 'back')
    private readonly configRepo: Repository<PedidoItemConfig>,
    @InjectRepository(PedidoItemSerie, 'back')
    private readonly reservaRepo: Repository<PedidoItemSerie>,
    @InjectRepository(StkNumeroSerie)
    private readonly serieRepo: Repository<StkNumeroSerie>,
    @InjectDataSource('back') private readonly backDataSource: DataSource,
    @InjectDataSource() private readonly externalDataSource: DataSource,
    private readonly stockService: StkExistenciaService,
  ) {}

  async configuraciones(items: string[]): Promise<Map<string, PedidoItemConfig>> {
    if (!items.length) return new Map();
    const rows = await this.configRepo.find({ where: { item: In(items) } });
    return new Map(rows.map((row) => [row.item, row]));
  }

  async disponibilidadSeries(items: string[]): Promise<Map<string, number>> {
    if (!items.length) return new Map();
    const abiertas = await this.serieRepo
      .createQueryBuilder('serie')
      .select('serie.item', 'item')
      .addSelect('COUNT(*)', 'cantidad')
      .where('serie.item IN (:...items)', { items })
      .andWhere('serie.ingreso IS NOT NULL')
      .andWhere('serie.egreso IS NULL')
      .groupBy('serie.item')
      .getRawMany<{ item: string; cantidad: string }>();
    const reservadas = await this.reservaRepo
      .createQueryBuilder('reserva')
      .select('reserva.item', 'item')
      .addSelect('COUNT(*)', 'cantidad')
      .where('reserva.item IN (:...items)', { items })
      .andWhere('reserva.estado IN (:...estados)', { estados: ESTADOS_RESERVA })
      .groupBy('reserva.item')
      .getRawMany<{ item: string; cantidad: string }>();
    const usadas = new Map(reservadas.map((r) => [r.item, Number(r.cantidad)]));
    return new Map(
      abiertas.map((r) => [r.item, Math.max(0, Number(r.cantidad) - (usadas.get(r.item) ?? 0))]),
    );
  }

  async reservarParaPedido(pedido: Pedido, ttlMinutos: number): Promise<void> {
    const configs = await this.configuraciones(pedido.productos.map((p) => p.nombre));
    const expiraEn = new Date(Date.now() + ttlMinutos * 60_000);

    for (const producto of pedido.productos) {
      const config = configs.get(producto.nombre);
      if (!config?.controla_serie) continue;
      if (!config.habilitado_web) {
        throw new ConflictException(`${producto.nombre} no está habilitado para venta web`);
      }

      const activas = await this.reservaRepo.find({
        select: { item: true, serie: true },
        where: { item: producto.nombre, estado: In(ESTADOS_ACTIVOS) },
      });
      const excluidas = new Set(activas.map((r) => r.serie));
      const abiertas = await this.serieRepo.find({
        where: { item: producto.nombre, egreso: IsNull() },
        order: { ingreso: 'ASC', serie: 'ASC' },
      });
      const elegidas = abiertas
        .filter((serie) => serie.ingreso !== null && !excluidas.has(serie.serie))
        .slice(0, producto.cantidad);

      if (elegidas.length !== producto.cantidad) {
        throw new ConflictException(
          `Series insuficientes para ${producto.nombre}. Disponibles: ${elegidas.length}, solicitadas: ${producto.cantidad}`,
        );
      }

      try {
        await this.backDataSource.transaction(async (manager) => {
          const repo = manager.getRepository(PedidoItemSerie);
          await repo.save(
            elegidas.map((serie) =>
              repo.create({
                pedido_id: pedido.id,
                pedido_item_id: producto.id,
                item: producto.nombre,
                serie: serie.serie,
                estado: PedidoItemSerieEstado.RESERVADA,
                expira_en: expiraEn,
              }),
            ),
          );
        });
      } catch (error) {
        throw new ConflictException(
          `Una de las series de ${producto.nombre} fue reservada por otro pedido`,
          { cause: error },
        );
      }
    }
  }

  async reservarStockPedido(productos: PedidoItem[]): Promise<void> {
    await this.externalDataSource.transaction(async (manager) => {
      for (const producto of productos) {
        producto.deposito = await this.stockService.reservarStock(
          producto.nombre,
          producto.cantidad,
          producto.deposito ?? undefined,
          manager,
        );
      }
    });
  }

  async liberarPedido(
    pedidoId: number,
    estado: PedidoItemSerieEstado.LIBERADA | PedidoItemSerieEstado.CANCELADA,
  ): Promise<void> {
    await this.reservaRepo
      .createQueryBuilder()
      .update(PedidoItemSerie)
      .set({ estado, liberada_en: new Date() })
      .where('pedido_id = :pedidoId', { pedidoId })
      .andWhere('estado IN (:...estados)', {
        estados: [PedidoItemSerieEstado.RESERVADA, PedidoItemSerieEstado.CONFIRMANDO],
      })
      .execute();
  }

  async confirmarPedido(
    pedido: Pedido,
    tipo: string,
    comprobante: string,
  ): Promise<void> {
    const yaConfirmadas = await this.reservaRepo.count({
      where: {
        pedido_id: pedido.id,
        estado: PedidoItemSerieEstado.CONFIRMADA,
        comprobante_tipo: tipo,
        comprobante,
      },
    });
    if (yaConfirmadas > 0) return;

    const reservas = await this.reservaRepo.find({
      where: { pedido_id: pedido.id, estado: PedidoItemSerieEstado.RESERVADA },
      order: { id: 'ASC' },
    });

    await this.sustituirSeriesNoDisponibles(reservas);

    if (reservas.length) {
      await this.reservaRepo.update(
        reservas.map((r) => r.id),
        { estado: PedidoItemSerieEstado.CONFIRMANDO },
      );
    }

    try {
      const lineas = await this.externalDataSource.query(
        'SELECT linea, item FROM vta_comprobante_item WHERE tipo = ? AND comprobante = ? ORDER BY linea',
        [tipo, comprobante],
      );
      const lineaPorPedidoItem = new Map<number, number>();
      for (let index = 0; index < pedido.productos.length; index++) {
        const producto = pedido.productos[index];
        const linea = lineas[index];
        if (!linea || linea.item !== producto.nombre) {
          throw new ConflictException(`La línea ${index + 1} no coincide con ${producto.nombre}`);
        }
        lineaPorPedidoItem.set(producto.id, Number(linea.linea));
      }

      await this.externalDataSource.transaction(async (manager) => {
        for (const producto of pedido.productos) {
          await this.stockService.confirmarStock(
            producto.nombre,
            producto.cantidad,
            producto.deposito ?? undefined,
            manager,
          );
        }

        for (const reserva of reservas) {
          const linea = lineaPorPedidoItem.get(reserva.pedido_item_id);
          if (!linea) throw new ConflictException(`No existe línea para ${reserva.item}`);

          const result = await manager
            .createQueryBuilder()
            .update(StkNumeroSerie)
            .set({ egreso: () => 'CURRENT_DATE' })
            .where('item = :item AND serie = :serie AND egreso IS NULL', reserva)
            .execute();
          if (result.affected !== 1) {
            throw new ConflictException(`La serie ${reserva.item}/${reserva.serie} ya no está disponible`);
          }
          await manager.getRepository(VtaSerieItem).insert({
            tipo,
            comprobante,
            linea,
            item: reserva.item,
            serie: reserva.serie,
          });
          reserva.comprobante_linea = linea;
        }
      });

      if (reservas.length) await this.reservaRepo.save(
        reservas.map((reserva) => ({
          ...reserva,
          estado: PedidoItemSerieEstado.CONFIRMADA,
          confirmada_en: new Date(),
          comprobante_tipo: tipo,
          comprobante,
        })),
      );
    } catch (error) {
      this.logger.error(`No se pudieron confirmar las series del pedido ${pedido.id}`, error);
      if (reservas.length) {
        await this.reservaRepo.update(
          reservas.map((r) => r.id),
          { estado: PedidoItemSerieEstado.RESERVADA },
        );
      }
      throw error;
    }
  }

  async seriesDelPedido(pedidoId: number): Promise<PedidoItemSerie[]> {
    return this.reservaRepo.find({ where: { pedido_id: pedidoId }, order: { id: 'ASC' } });
  }

  private async sustituirSeriesNoDisponibles(
    reservas: PedidoItemSerie[],
  ): Promise<void> {
    for (const reserva of reservas) {
      const disponible = await this.serieRepo.findOne({
        where: { item: reserva.item, serie: reserva.serie, egreso: IsNull() },
      });
      if (disponible) continue;

      const activas = await this.reservaRepo.find({
        select: { id: true, serie: true },
        where: { item: reserva.item, estado: In(ESTADOS_ACTIVOS) },
      });
      const excluidas = new Set(
        activas.filter((activa) => activa.id !== reserva.id).map((activa) => activa.serie),
      );
      const candidatas = await this.serieRepo.find({
        where: { item: reserva.item, egreso: IsNull() },
        order: { ingreso: 'ASC', serie: 'ASC' },
      });
      const reemplazo = candidatas.find(
        (candidata) => candidata.ingreso !== null && !excluidas.has(candidata.serie),
      );
      if (!reemplazo) {
        throw new ConflictException(`No hay una serie de reemplazo para ${reserva.item}`);
      }
      reserva.serie = reemplazo.serie;
      await this.reservaRepo.save(reserva);
    }
  }

  async reconciliarConfirmaciones(): Promise<{ confirmadas: number; reintentables: number }> {
    const antiguas = await this.reservaRepo.find({
      where: {
        estado: PedidoItemSerieEstado.CONFIRMANDO,
        reservada_en: LessThan(new Date(Date.now() - 15 * 60_000)),
      },
    });
    let confirmadas = 0;
    let reintentables = 0;
    for (const reserva of antiguas) {
      const rows = await this.externalDataSource.query(
        'SELECT tipo, comprobante, linea FROM vta_serie_item WHERE item = ? AND serie = ? LIMIT 1',
        [reserva.item, reserva.serie],
      );
      if (rows.length) {
        reserva.estado = PedidoItemSerieEstado.CONFIRMADA;
        reserva.confirmada_en = new Date();
        reserva.comprobante_tipo = rows[0].tipo;
        reserva.comprobante = rows[0].comprobante;
        reserva.comprobante_linea = Number(rows[0].linea);
        confirmadas++;
      } else {
        reserva.estado = PedidoItemSerieEstado.RESERVADA;
        reintentables++;
      }
      await this.reservaRepo.save(reserva);
    }
    return { confirmadas, reintentables };
  }
}
