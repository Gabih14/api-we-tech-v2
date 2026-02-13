import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { Pedido } from './entities/pedido.entity';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';
import { CobrosService } from 'src/vta-comprobante/cobros.service';
import { PedidoService } from './pedido.service';

@Injectable()
export class PedidoExpirationService {
  private readonly logger = new Logger(PedidoExpirationService.name);

  constructor(
    @InjectRepository(Pedido, 'back')
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly existenciaService: StkExistenciaService,
    private readonly cobrosService: CobrosService,
    private readonly pedidoService: PedidoService,
  ) {}

  async run(ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30)) {
    const ttlTransferMin = Number(process.env.PEDIDO_TRANSFER_TTL_MIN || 2880); // 48 horas por defecto

    const cutoffOnline = new Date(Date.now() - ttlMin * 60_000);
    const cutoffTransfer = new Date(Date.now() - ttlTransferMin * 60_000);

    // Buscar pedidos PENDIENTES expirados según tipo de pago
    const pendientesOnline = await this.pedidoRepo.find({
      where: {
        estado: 'PENDIENTE',
        metodo_pago: 'online',
        creado: LessThan(cutoffOnline),
      },
      relations: ['productos'],
    });

    const pendientesTransfer = await this.pedidoRepo.find({
      where: {
        estado: 'PENDIENTE',
        metodo_pago: 'transfer',
        creado: LessThan(cutoffTransfer),
      },
      relations: ['productos'],
    });

    const pendientes = [...pendientesOnline, ...pendientesTransfer];

    if (!pendientes.length) return { expirados: 0 };

    let expirados = 0;
    let fallos = 0;

    for (const pedido of pendientes) {
      const liberacionesExitosas: Array<{ nombre: string; cantidad: number }> = [];
      let tieneErrores = false;

      try {
        // 1️⃣ Intentar liberar cada producto
        for (const p of pedido.productos) {
          try {
            await this.existenciaService.liberarStock(p.nombre, p.cantidad);
            liberacionesExitosas.push({ nombre: p.nombre, cantidad: p.cantidad });
          } catch (stockError) {
            tieneErrores = true;
            this.logger.warn(
              `[${pedido.external_id}] No se pudo liberar stock de ${p.nombre} (${p.cantidad}): ${stockError?.message || stockError}`,
            );
          }
        }

        // 2️⃣ Marcar como cancelado incluso si hubo fallos parciales
        pedido.estado = 'CANCELADO';
        await this.pedidoRepo.save(pedido);
        expirados++;

        // 3️⃣ Registrar el resultado
        if (tieneErrores) {
          this.logger.log(
            `[${pedido.external_id}] Cancelado con advertencias. Liberadas: ${liberacionesExitosas.length}/${pedido.productos.length}`,
          );
        } else {
          this.logger.log(`[${pedido.external_id}] Cancelado exitosamente`);
        }
      } catch (e) {
        fallos++;
        this.logger.error(
          `[${pedido.external_id}] Error crítico durante expiración: ${e?.message || e}`,
        );
      }
    }

    return { expirados, fallos, total: pendientes.length };
  }

  @Cron(process.env.PEDIDO_TTL_CRON || '*/10 * * * *')
  async scheduledRun() {
    const ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30);
    const resultado = await this.run(ttlMin);

    if (resultado.expirados > 0) {
      this.logger.log(
        `Expiración completada: ${resultado.expirados}/${resultado.total} cancelados, ${resultado.fallos} errores críticos`,
      );
    }
  }

  @Cron(process.env.PEDIDO_TRANSFER_APPROVAL_CRON || '*/10 * * * *')
  async scheduledTransferApproval() {
    const pendientes = await this.pedidoRepo.find({
      where: {
        estado: 'PENDIENTE',
        metodo_pago: 'transfer',
        comprobante_tipo: Not(IsNull()),
        comprobante_numero: Not(IsNull()),
      },
      relations: ['productos'],
    });

    if (!pendientes.length) return;

    for (const pedido of pendientes) {
      const tipo = pedido.comprobante_tipo;
      const comprobante = pedido.comprobante_numero;

      if (!tipo || !comprobante) continue;

      try {
        const tieneCobro = await this.cobrosService.tieneCobroFactura(tipo, comprobante);
        if (!tieneCobro) continue;

        await this.pedidoService.aprobarTransferencia(pedido.external_id);
        this.logger.log(`[${pedido.external_id}] Pedido transferencia aprobado por cobro registrado`);
      } catch (e) {
        this.logger.error(
          `[${pedido.external_id}] Error en aprobación automática: ${e?.message || e}`,
        );
      }
    }
  }
}
