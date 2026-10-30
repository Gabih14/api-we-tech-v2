import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { StkExistencia } from './entities/stk-existencia.entity';
import { CreateStkExistenciaDto } from './dto/create-stk-existencia.dto';
import { UpdateStkExistenciaDto } from './dto/update-stk-existencia.dto';
import { PedidoItem } from 'src/pedido/entities/pedido-item.entity';
import { Pedido, PedidoEstado } from 'src/pedido/entities/pedido.entity';
import { StockReserva } from './entities/stock-reserva.entity';
import { StockReservaItem } from './entities/stock-reserva-item.entity';
import { StockReservaEvento } from './entities/stock-reserva-evento.entity';

export interface StockSolicitud {
  item: string;
  cantidad: number;
  deposito?: string;
}

export interface StockReservado {
  item: string;
  cantidad: number;
  deposito: string;
  reservaId?: string;
}

export interface StockReservaContexto {
  externalId: string;
  reservaId?: string;
}

export interface StockConfirmado {
  item: string;
  cantidad: number;
  depositoReserva: string;
}

export interface StockComprometidoPedido {
  pedido_id: number;
  external_id: string;
  estado: PedidoEstado;
  metodo_pago: 'online' | 'transfer';
  cliente_nombre: string;
  cantidad: number;
}

export interface StockComprometidoDetalle {
  item: string;
  deposito: string;
  cantidad: number;
  comprometido: number;
  cantidad_asignada_a_pedidos: number;
  cantidad_sin_pedido: number;
  diferencia_comprometido: number;
  pedidos: StockComprometidoPedido[];
}

export interface StockComprometidoRestaurado {
  item: string;
  deposito: string;
  cantidad_restaurada: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  comprometido_anterior: number;
  comprometido_nuevo: number;
}

@Injectable()
export class StkExistenciaService {
  constructor(
    @InjectRepository(StkExistencia)
    private readonly stkExistenciaRepository: Repository<StkExistencia>,

    @InjectRepository(PedidoItem, 'back')
    private readonly pedidoItemRepository: Repository<PedidoItem>,
  ) {}

  async create(
    createStkExistenciaDto: CreateStkExistenciaDto,
  ): Promise<StkExistencia> {
    const existencia = this.stkExistenciaRepository.create(
      createStkExistenciaDto,
    );
    return await this.stkExistenciaRepository.save(existencia);
  }

  async findAll(): Promise<StkExistencia[]> {
    return await this.stkExistenciaRepository.find();
  }

  async findComprometidosConPedidos(): Promise<StockComprometidoDetalle[]> {
    const existencias = await this.stkExistenciaRepository
      .createQueryBuilder('existencia')
      .where('COALESCE(existencia.comprometido, 0) > 0')
      .orderBy('existencia.item', 'ASC')
      .addOrderBy('existencia.deposito', 'ASC')
      .getMany();

    if (!existencias.length) {
      return [];
    }

    const items = [
      ...new Set(existencias.map((existencia) => existencia.item)),
    ];
    const depositos = [
      ...new Set(existencias.map((existencia) => existencia.deposito)),
    ];

    const asignaciones = await this.pedidoItemRepository
      .createQueryBuilder('pedidoItem')
      .innerJoin('pedidoItem.pedido', 'pedido')
      .select('pedidoItem.nombre', 'item')
      .addSelect('pedidoItem.deposito_reserva', 'deposito')
      .addSelect('pedido.id', 'pedido_id')
      .addSelect('pedido.external_id', 'external_id')
      .addSelect('pedido.estado', 'estado')
      .addSelect('pedido.metodo_pago', 'metodo_pago')
      .addSelect('pedido.cliente_nombre', 'cliente_nombre')
      .addSelect('SUM(pedidoItem.cantidad)', 'cantidad')
      .where('pedido.estado IN (:...estados)', {
        estados: ['PENDIENTE', 'ERROR_STOCK', 'REQUIERE_ATENCION'],
      })
      .andWhere('pedidoItem.nombre IN (:...items)', { items })
      .andWhere('pedidoItem.deposito_reserva IN (:...depositos)', { depositos })
      .groupBy('pedidoItem.nombre')
      .addGroupBy('pedidoItem.deposito_reserva')
      .addGroupBy('pedido.id')
      .addGroupBy('pedido.external_id')
      .addGroupBy('pedido.estado')
      .addGroupBy('pedido.metodo_pago')
      .addGroupBy('pedido.cliente_nombre')
      .getRawMany<{
        item: string;
        deposito: string;
        pedido_id: number;
        external_id: string;
        estado: PedidoEstado;
        metodo_pago: 'online' | 'transfer';
        cliente_nombre: string;
        cantidad: string;
      }>();

    const asignacionesPorExistencia = new Map<
      string,
      StockComprometidoPedido[]
    >();

    for (const asignacion of asignaciones) {
      const key = this.stockKey(asignacion.item, asignacion.deposito);
      const pedidos = asignacionesPorExistencia.get(key) ?? [];
      pedidos.push({
        pedido_id: Number(asignacion.pedido_id),
        external_id: asignacion.external_id,
        estado: asignacion.estado,
        metodo_pago: asignacion.metodo_pago,
        cliente_nombre: asignacion.cliente_nombre,
        cantidad: Number(asignacion.cantidad),
      });
      asignacionesPorExistencia.set(key, pedidos);
    }

    return existencias.map((existencia) => {
      const comprometido = Number(existencia.comprometido || 0);
      const pedidos =
        asignacionesPorExistencia.get(
          this.stockKey(existencia.item, existencia.deposito),
        ) ?? [];
      const cantidadAsignada = pedidos.reduce(
        (total, pedido) => total + pedido.cantidad,
        0,
      );
      const diferencia = comprometido - cantidadAsignada;

      return {
        item: existencia.item,
        deposito: existencia.deposito,
        cantidad: Number(existencia.cantidad || 0),
        comprometido,
        cantidad_asignada_a_pedidos: cantidadAsignada,
        cantidad_sin_pedido: Math.max(0, diferencia),
        diferencia_comprometido: diferencia,
        pedidos,
      };
    });
  }

  async restaurarComprometidosSinPedido(): Promise<{
    restaurados: StockComprometidoRestaurado[];
    total_items: number;
    total_cantidad_restaurada: number;
  }> {
    const comprometidos = await this.findComprometidosConPedidos();
    const pendientesRestaurar = comprometidos.filter(
      (detalle) => detalle.cantidad_sin_pedido > 0,
    );

    if (!pendientesRestaurar.length) {
      return {
        restaurados: [],
        total_items: 0,
        total_cantidad_restaurada: 0,
      };
    }

    const restaurados = await this.stkExistenciaRepository.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(StkExistencia);
        const resultado: StockComprometidoRestaurado[] = [];

        for (const pendiente of pendientesRestaurar) {
          const existencia = await repo.findOne({
            where: {
              item: pendiente.item,
              deposito: pendiente.deposito,
            },
            lock: { mode: 'pessimistic_write' },
          });

          if (!existencia) {
            throw new NotFoundException(
              `Existencia no encontrada para ${pendiente.item} en ${pendiente.deposito}`,
            );
          }

          const cantidadAnterior = Number(existencia.cantidad || 0);
          const comprometidoAnterior = Number(existencia.comprometido || 0);
          const cantidadRestaurada = Math.min(
            pendiente.cantidad_sin_pedido,
            comprometidoAnterior,
          );

          if (cantidadRestaurada <= 0) {
            continue;
          }

          const cantidadNueva = cantidadAnterior + cantidadRestaurada;
          const comprometidoNuevo = comprometidoAnterior - cantidadRestaurada;

          existencia.cantidad = cantidadNueva.toString();
          existencia.comprometido = comprometidoNuevo.toString();
          await repo.save(existencia);

          resultado.push({
            item: existencia.item,
            deposito: existencia.deposito,
            cantidad_restaurada: cantidadRestaurada,
            cantidad_anterior: cantidadAnterior,
            cantidad_nueva: cantidadNueva,
            comprometido_anterior: comprometidoAnterior,
            comprometido_nuevo: comprometidoNuevo,
          });
        }

        return resultado;
      },
    );

    return {
      restaurados,
      total_items: restaurados.length,
      total_cantidad_restaurada: restaurados.reduce(
        (total, restaurado) => total + restaurado.cantidad_restaurada,
        0,
      ),
    };
  }

  async findOne(item: string, deposito: string): Promise<StkExistencia> {
    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) {
      throw new NotFoundException(
        `Existencia no encontrada para item: ${item} y deposito: ${deposito}`,
      );
    }
    return existencia;
  }

  async update(
    item: string,
    deposito: string,
    updateStkExistenciaDto: UpdateStkExistenciaDto,
  ): Promise<StkExistencia> {
    const existencia = await this.findOne(item, deposito);
    Object.assign(existencia, updateStkExistenciaDto);
    return await this.stkExistenciaRepository.save(existencia);
  }

  private stockKey(item: string, deposito: string): string {
    return `${item}\u0000${deposito}`;
  }

  async remove(item: string, deposito: string): Promise<void> {
    const existencia = await this.findOne(item, deposito);
    await this.stkExistenciaRepository.remove(existencia);
  }

  async reservarStock(
    item: string,
    cantidad: number,
    depositoPreferido?: string,
  ): Promise<string> {
    const [reserva] = await this.reservarStockLote([
      { item, cantidad, deposito: depositoPreferido },
    ]);
    return reserva.deposito;
  }

  /**
   * Reserva un pedido completo de forma atomica. La existencia que el ERP
   * puede vender baja al mismo tiempo que aumenta el compromiso.
   */
  async reservarStockLote(
    solicitudes: StockSolicitud[],
    contexto?: StockReservaContexto,
  ): Promise<StockReservado[]> {
    const normalizadas = solicitudes
      .map((solicitud, indice) => {
        const cantidad = Number(solicitud.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new ConflictException(
            `Cantidad invalida para ${solicitud.item}: ${solicitud.cantidad}`,
          );
        }
        return { ...solicitud, cantidad, indice };
      })
      .sort((a, b) => {
        const itemComparison = a.item.localeCompare(b.item);
        return (
          itemComparison ||
          (a.deposito ?? '').localeCompare(b.deposito ?? '') ||
          a.indice - b.indice
        );
      });

    return this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const reservaRepo = manager.getRepository(StockReserva);
      const reservaItemRepo = manager.getRepository(StockReservaItem);
      let reservaPersistida: StockReserva | null = null;

      if (contexto) {
        reservaPersistida = await reservaRepo.findOne({
          where: { externalId: contexto.externalId },
          lock: { mode: 'pessimistic_write' },
        });
        if (reservaPersistida?.estado === 'RESERVADA') {
          reservaPersistida.actualizado = new Date();
          await reservaRepo.save(reservaPersistida);
          const items = await reservaItemRepo.find({
            where: { reservaId: reservaPersistida.id },
            order: { id: 'ASC' },
          });
          return items.map((item) => ({
            item: item.item,
            cantidad: Number(item.cantidad),
            deposito: item.deposito,
            reservaId: reservaPersistida!.id,
          }));
        }
        if (reservaPersistida?.estado === 'CONFIRMADA') {
          throw new ConflictException(
            `La reserva ${reservaPersistida.id} ya fue confirmada`,
          );
        }
      }
      const existenciasPorItem = new Map<string, StkExistencia[]>();
      const cantidadPlanificada = new Map<StkExistencia, number>();
      const resultados: StockReservado[] = new Array(normalizadas.length);

      for (const solicitud of normalizadas) {
        if (solicitud.item.startsWith('ENV')) {
          resultados[solicitud.indice] = {
            item: solicitud.item,
            cantidad: solicitud.cantidad,
            deposito: 'ENV',
          };
          continue;
        }

        let existencias = existenciasPorItem.get(solicitud.item);
        if (!existencias) {
          existencias = await repo.find({
            where: { item: solicitud.item },
            lock: { mode: 'pessimistic_write' },
          });
          existenciasPorItem.set(solicitud.item, existencias);
        }

        if (!existencias.length) {
          throw new NotFoundException(
            `Item ${solicitud.item} no encontrado en ningun deposito`,
          );
        }

        const disponible = (row: StkExistencia) =>
          Number(row.cantidad || 0) - (cantidadPlanificada.get(row) ?? 0);
        const existencia = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : [...existencias].sort((a, b) => disponible(b) - disponible(a))[0];

        if (!existencia) {
          throw new NotFoundException(
            `Stock no encontrado para ${solicitud.item}${
              solicitud.deposito ? ` en ${solicitud.deposito}` : ''
            }`,
          );
        }

        const stockDisponible = disponible(existencia);
        if (stockDisponible < solicitud.cantidad) {
          throw new ConflictException(
            `Stock insuficiente para ${solicitud.item} en ${existencia.deposito}. Disponible: ${stockDisponible}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        cantidadPlanificada.set(
          existencia,
          (cantidadPlanificada.get(existencia) ?? 0) + solicitud.cantidad,
        );
        resultados[solicitud.indice] = {
          item: solicitud.item,
          cantidad: solicitud.cantidad,
          deposito: existencia.deposito,
        };
      }

      const modificadas = new Set<StkExistencia>();
      for (const [existencia, cantidadReservada] of cantidadPlanificada) {
        existencia.cantidad = (
          Number(existencia.cantidad || 0) - cantidadReservada
        ).toString();
        existencia.comprometido = (
          Number(existencia.comprometido || 0) + cantidadReservada
        ).toString();
        modificadas.add(existencia);
      }

      if (modificadas.size) {
        await repo.save([...modificadas]);
      }

      if (contexto) {
        const reservaId =
          reservaPersistida?.id ?? contexto.reservaId ?? randomUUID();
        const tipoEvento = reservaPersistida ? 'REACTIVADA' : 'RESERVADA';
        if (reservaPersistida) {
          reservaPersistida.estado = 'RESERVADA';
          reservaPersistida.motivo = null;
        } else {
          reservaPersistida = reservaRepo.create({
            id: reservaId,
            externalId: contexto.externalId,
            estado: 'RESERVADA',
            motivo: null,
          });
        }
        await reservaRepo.save(reservaPersistida);
        await reservaItemRepo.delete({ reservaId });
        await reservaItemRepo.save(
          resultados.map((resultado) =>
            reservaItemRepo.create({
              reservaId,
              item: resultado.item,
              deposito: resultado.deposito,
              cantidad: resultado.cantidad.toString(),
            }),
          ),
        );
        const eventoRepo = manager.getRepository(StockReservaEvento);
        await eventoRepo.save(
          eventoRepo.create({
            reservaId,
            tipo: tipoEvento,
            motivo: null,
          }),
        );
        resultados.forEach((resultado) => (resultado.reservaId = reservaId));
      }

      return resultados;
    });
  }

  async confirmarStock(
    item: string,
    cantidad: number,
    deposito?: string,
  ): Promise<string> {
    const [confirmacion] = await this.confirmarStockLote([
      { item, cantidad, deposito },
    ]);
    return confirmacion.depositoReserva;
  }

  /**
   * Confirma todas las reservas como una unica operacion. Las filas quedan
   * bloqueadas hasta validar y guardar el lote completo; si una linea falla,
   * la transaccion revierte cualquier cambio anterior.
   */
  async confirmarStockLote(
    solicitudes: StockSolicitud[],
    reservaId?: string,
  ): Promise<StockConfirmado[]> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    return this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const reservaRepo = manager.getRepository(StockReserva);
      const reservaItemRepo = manager.getRepository(StockReservaItem);
      const reserva = reservaId
        ? await reservaRepo.findOne({
            where: { id: reservaId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (reserva?.estado === 'CONFIRMADA') {
        const items = await reservaItemRepo.find({ where: { reservaId } });
        return items.map((item) => ({
          item: item.item,
          cantidad: Number(item.cantidad),
          depositoReserva: item.deposito,
        }));
      }
      if (reserva?.estado === 'LIBERADA') {
        throw new ConflictException(`La reserva ${reservaId} ya fue liberada`);
      }
      const confirmaciones: Array<{
        existencia: StkExistencia;
        item: string;
        cantidad: number;
        depositoReserva: string;
      }> = [];
      const virtuales: StockConfirmado[] = [];
      const compromisoPlanificado = new Map<StkExistencia, number>();

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) {
          virtuales.push({
            item: solicitud.item,
            cantidad: solicitud.cantidad,
            depositoReserva: 'ENV',
          });
          continue;
        }

        const existencias = await repo.find({
          where: { item: solicitud.item },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existencias.length) {
          throw new NotFoundException(
            `Stock no encontrado para ${solicitud.item}${
              solicitud.deposito ? ` en ${solicitud.deposito}` : ''
            }`,
          );
        }

        const reservaPreferida = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : undefined;
        const compromisoDisponible = (row: StkExistencia) =>
          Number(row.comprometido || 0) - (compromisoPlanificado.get(row) ?? 0);
        const existencia =
          (reservaPreferida &&
          compromisoDisponible(reservaPreferida) >= solicitud.cantidad
            ? reservaPreferida
            : undefined) ??
          existencias
            .filter((row) => compromisoDisponible(row) >= solicitud.cantidad)
            .sort(
              (a, b) => compromisoDisponible(b) - compromisoDisponible(a),
            )[0];

        if (!existencia) {
          const compromisoMaximo = Math.max(
            0,
            ...existencias.map((row) => compromisoDisponible(row)),
          );
          throw new ConflictException(
            `Reserva insuficiente para ${solicitud.item}. Comprometido maximo: ${compromisoMaximo}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        const comprometido = compromisoDisponible(existencia);
        if (comprometido < solicitud.cantidad) {
          throw new ConflictException(
            `Reserva insuficiente para ${solicitud.item} en ${existencia.deposito}. Comprometido: ${comprometido}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        confirmaciones.push({
          existencia,
          item: solicitud.item,
          cantidad: solicitud.cantidad,
          depositoReserva: existencia.deposito,
        });
        compromisoPlanificado.set(
          existencia,
          (compromisoPlanificado.get(existencia) ?? 0) + solicitud.cantidad,
        );
      }

      const existenciasModificadas = new Set<StkExistencia>();
      for (const confirmacion of confirmaciones) {
        const comprometido = Number(confirmacion.existencia.comprometido || 0);
        confirmacion.existencia.comprometido = (
          comprometido - confirmacion.cantidad
        ).toString();
        existenciasModificadas.add(confirmacion.existencia);
      }

      if (existenciasModificadas.size) {
        await repo.save([...existenciasModificadas]);
      }

      if (reserva) {
        reserva.estado = 'CONFIRMADA';
        reserva.motivo = null;
        await reservaRepo.save(reserva);
        const eventoRepo = manager.getRepository(StockReservaEvento);
        await eventoRepo.save(
          eventoRepo.create({
            reservaId: reserva.id,
            tipo: 'CONFIRMADA',
            motivo: null,
          }),
        );
      }

      return [
        ...confirmaciones.map(({ item, cantidad, depositoReserva }) => ({
          item,
          cantidad,
          depositoReserva,
        })),
        ...virtuales,
      ];
    });
  }

  /**
   * Compensa una confirmacion cuando falla una operacion critica posterior.
   * La existencia ya se desconto al reservar; solo repone el compromiso.
   */
  async restaurarStockConfirmado(
    item: string,
    cantidad: number,
    deposito: string,
  ): Promise<void> {
    if (item.startsWith('ENV') || deposito === 'ENV') return;

    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) {
      throw new NotFoundException(
        `No se pudo restaurar stock para ${item} en ${deposito}`,
      );
    }

    existencia.comprometido = (
      Number(existencia.comprometido || 0) + cantidad
    ).toString();

    await this.stkExistenciaRepository.save(existencia);
  }

  async restaurarStockConfirmadoLote(
    confirmaciones: StockConfirmado[],
    reservaId?: string,
  ): Promise<void> {
    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const existenciasRestauradas = new Set<StkExistencia>();

      for (const confirmacion of confirmaciones) {
        if (
          confirmacion.item.startsWith('ENV') ||
          confirmacion.depositoReserva === 'ENV'
        ) {
          continue;
        }

        const existencias = await repo.find({
          where: { item: confirmacion.item },
          lock: { mode: 'pessimistic_write' },
        });
        const existenciaReserva = existencias.find(
          (row) => row.deposito === confirmacion.depositoReserva,
        );
        if (!existenciaReserva) {
          throw new NotFoundException(
            `No se pudo restaurar la reserva de ${confirmacion.item} en ${confirmacion.depositoReserva}`,
          );
        }

        existenciaReserva.comprometido = (
          Number(existenciaReserva.comprometido || 0) + confirmacion.cantidad
        ).toString();
        existenciasRestauradas.add(existenciaReserva);
      }

      if (existenciasRestauradas.size) {
        await repo.save([...existenciasRestauradas]);
      }

      if (reservaId) {
        const reservaRepo = manager.getRepository(StockReserva);
        const reserva = await reservaRepo.findOne({
          where: { id: reservaId },
          lock: { mode: 'pessimistic_write' },
        });
        if (reserva) {
          reserva.estado = 'RESERVADA';
          reserva.motivo = 'Confirmacion compensada por error posterior';
          await reservaRepo.save(reserva);
          const eventoRepo = manager.getRepository(StockReservaEvento);
          await eventoRepo.save(
            eventoRepo.create({
              reservaId: reserva.id,
              tipo: 'CONFIRMACION_COMPENSADA',
              motivo: reserva.motivo,
            }),
          );
        }
      }
    });
  }

  private agruparSolicitudes(solicitudes: StockSolicitud[]): StockSolicitud[] {
    const agrupadas = new Map<string, StockSolicitud>();

    for (const solicitud of solicitudes) {
      const cantidad = Number(solicitud.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ConflictException(
          `Cantidad invalida para ${solicitud.item}: ${solicitud.cantidad}`,
        );
      }

      const key = `${solicitud.item}\u0000${solicitud.deposito ?? ''}`;
      const existente = agrupadas.get(key);
      if (existente) {
        existente.cantidad += cantidad;
      } else {
        agrupadas.set(key, { ...solicitud, cantidad });
      }
    }

    return [...agrupadas.values()].sort((a, b) => {
      const itemComparison = a.item.localeCompare(b.item);
      return (
        itemComparison || (a.deposito ?? '').localeCompare(b.deposito ?? '')
      );
    });
  }

  async liberarStock(item: string, cantidad: number, deposito?: string) {
    await this.liberarStockLote([{ item, cantidad, deposito }]);
  }

  /**
   * Libera todas las reservas de un pedido de forma atomica. Primero valida
   * el lote completo y bloquea las existencias involucradas; si una reserva
   * no existe o es insuficiente, no modifica ninguna fila.
   */
  async liberarStockLote(
    solicitudes: StockSolicitud[],
    reservaId?: string,
    motivo = 'Reserva liberada',
  ): Promise<void> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const reservaRepo = manager.getRepository(StockReserva);
      const reserva = reservaId
        ? await reservaRepo.findOne({
            where: { id: reservaId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (reserva?.estado === 'LIBERADA') return;
      if (reserva?.estado === 'CONFIRMADA') {
        throw new ConflictException(
          `La reserva ${reservaId} ya fue confirmada y no puede liberarse`,
        );
      }
      const liberaciones: Array<{
        existencia: StkExistencia;
        cantidad: number;
      }> = [];

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) continue;

        const existencias = await repo.find({
          where: { item: solicitud.item },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existencias.length) {
          throw new NotFoundException(
            `Stock no encontrado para ${solicitud.item}`,
          );
        }

        const existencia = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : existencias
              .filter(
                (row) => Number(row.comprometido || 0) >= solicitud.cantidad,
              )
              .sort(
                (a, b) =>
                  Number(b.comprometido || 0) - Number(a.comprometido || 0),
              )[0];

        if (!existencia) {
          throw new NotFoundException(
            `Reserva no encontrada para ${solicitud.item}${
              solicitud.deposito ? ` en ${solicitud.deposito}` : ''
            }`,
          );
        }

        const comprometido = Number(existencia.comprometido || 0);
        if (comprometido < solicitud.cantidad) {
          throw new ConflictException(
            `Reserva insuficiente para liberar ${solicitud.item} en ${existencia.deposito}. Comprometido: ${comprometido}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        liberaciones.push({ existencia, cantidad: solicitud.cantidad });
      }

      const modificadas = new Set<StkExistencia>();
      for (const liberacion of liberaciones) {
        liberacion.existencia.cantidad = (
          Number(liberacion.existencia.cantidad || 0) + liberacion.cantidad
        ).toString();
        liberacion.existencia.comprometido = (
          Number(liberacion.existencia.comprometido || 0) - liberacion.cantidad
        ).toString();
        modificadas.add(liberacion.existencia);
      }

      if (modificadas.size) {
        await repo.save([...modificadas]);
      }

      if (reserva) {
        reserva.estado = 'LIBERADA';
        reserva.motivo = motivo.slice(0, 255);
        await reservaRepo.save(reserva);
        const eventoRepo = manager.getRepository(StockReservaEvento);
        await eventoRepo.save(
          eventoRepo.create({
            reservaId: reserva.id,
            tipo: 'LIBERADA',
            motivo: reserva.motivo,
          }),
        );
      }
    });
  }

  async reconciliarReservasHuerfanas(antiguedadMinutos = 30): Promise<{
    revisadas: number;
    liberadas: Array<{ reservaId: string; externalId: string }>;
    confirmadas: Array<{ reservaId: string; externalId: string }>;
  }> {
    const minutos = Math.max(5, Number(antiguedadMinutos) || 30);
    const limite = new Date(Date.now() - minutos * 60_000);
    const reservaRepo =
      this.stkExistenciaRepository.manager.getRepository(StockReserva);
    const reservaItemRepo =
      this.stkExistenciaRepository.manager.getRepository(StockReservaItem);
    const pedidoRepo = this.pedidoItemRepository.manager.getRepository(Pedido);
    const candidatas = await reservaRepo.find({
      where: [
        { estado: 'RESERVADA', actualizado: LessThan(limite) },
        { estado: 'RESERVADA', actualizado: IsNull(), creado: LessThan(limite) },
      ],
      order: { creado: 'ASC' },
    });
    const liberadas: Array<{ reservaId: string; externalId: string }> = [];
    const confirmadas: Array<{ reservaId: string; externalId: string }> = [];

    for (const reserva of candidatas) {
      const pedido = await pedidoRepo.findOne({
        where: { external_id: reserva.externalId },
      });
      if (
        pedido &&
        ['PENDIENTE', 'ERROR_STOCK', 'REQUIERE_ATENCION'].includes(
          pedido.estado,
        )
      ) {
        continue;
      }

      const items = await reservaItemRepo.find({
        where: { reservaId: reserva.id },
      });
      const solicitudes = items.map((item) => ({
        item: item.item,
        cantidad: Number(item.cantidad),
        deposito: item.deposito,
      }));
      if (pedido && ['APROBADO', 'APROBADO_MANUAL'].includes(pedido.estado)) {
        await this.confirmarStockLote(solicitudes, reserva.id);
        confirmadas.push({
          reservaId: reserva.id,
          externalId: reserva.externalId,
        });
        continue;
      }
      await this.liberarStockLote(
        solicitudes,
        reserva.id,
        pedido
          ? `Reconciliacion: pedido en estado ${pedido.estado}`
          : 'Reconciliacion: pedido inexistente',
      );
      liberadas.push({ reservaId: reserva.id, externalId: reserva.externalId });
    }

    return { revisadas: candidatas.length, liberadas, confirmadas };
  }

  async obtenerTrazabilidadReserva(externalId: string) {
    const manager = this.stkExistenciaRepository.manager;
    const reserva = await manager.getRepository(StockReserva).findOne({
      where: { externalId },
    });
    if (!reserva) {
      throw new NotFoundException(
        `No existe una reserva para el pedido ${externalId}`,
      );
    }

    const [items, eventos, pedido] = await Promise.all([
      manager.getRepository(StockReservaItem).find({
        where: { reservaId: reserva.id },
        order: { id: 'ASC' },
      }),
      manager.getRepository(StockReservaEvento).find({
        where: { reservaId: reserva.id },
        order: { creado: 'ASC', id: 'ASC' },
      }),
      this.pedidoItemRepository.manager.getRepository(Pedido).findOne({
        where: { external_id: externalId },
      }),
    ]);

    return {
      reserva,
      items: items.map((item) => ({
        item: item.item,
        deposito: item.deposito,
        cantidad: Number(item.cantidad),
      })),
      eventos,
      pedido: pedido
        ? {
            id: pedido.id,
            external_id: pedido.external_id,
            estado: pedido.estado,
          }
        : null,
    };
  }
}
