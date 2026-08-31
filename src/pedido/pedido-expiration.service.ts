import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { Pedido } from './entities/pedido.entity';
import { CobrosService } from 'src/vta-comprobante/cobros.service';
import { PedidoService } from './pedido.service';

@Injectable()
export class PedidoExpirationService {
  private readonly logger = new Logger(PedidoExpirationService.name);
  private cancellationPauseLogged = false;
  private transferApprovalPauseLogged = false;

  constructor(
    @InjectRepository(Pedido, 'back')
    private readonly pedidoRepo: Repository<Pedido>,
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
      try {
        if (
          pedido.metodo_pago === 'transfer' &&
          pedido.comprobante_tipo &&
          pedido.comprobante_numero
        ) {
          const tieneCobro =
            await this.cobrosService.tieneCobroFacturaDelPedido(
              pedido.comprobante_tipo,
              pedido.comprobante_numero,
              pedido,
            );

          if (tieneCobro) {
            this.logger.warn(
              `[${pedido.external_id}] No se expira: la transferencia tiene un cobro asociado`,
            );
            continue;
          }
        }

        await this.pedidoService.cancelarPedidoPendiente(
          pedido.external_id,
          'Pedido cancelado automaticamente por expiracion',
        );
        expirados++;
        this.logger.log(`[${pedido.external_id}] Cancelado exitosamente`);
      } catch (e) {
        fallos++;
        this.logger.error(
          `[${pedido.external_id}] Error crítico durante expiración: ${e?.message || e}`,
        );
      }
    }

    return { expirados, fallos, total: pendientes.length };
  }

  @Cron(process.env.PEDIDO_TTL_CRON || '*/10 * * * 1-5', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  async scheduledRun() {
    if (!this.isCancellationWindowOpen()) {
      if (!this.cancellationPauseLogged) {
        this.logger.warn(
          'Cancelacion automatica pausada hasta el lunes a las 12:00 (hora de Buenos Aires)',
        );
        this.cancellationPauseLogged = true;
      }
      return;
    }

    this.cancellationPauseLogged = false;
    const ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30);
    const resultado = await this.run(ttlMin);

    if (resultado.expirados > 0) {
      this.logger.log(
        `Expiración completada: ${resultado.expirados}/${resultado.total} cancelados, ${resultado.fallos} errores críticos`,
      );
    }
  }

  @Cron(process.env.PEDIDO_TRANSFER_APPROVAL_CRON || '*/5 * * * *')
  async scheduledTransferApproval() {
    if (!this.isTransferApprovalEnabled()) {
      if (!this.transferApprovalPauseLogged) {
        this.logger.warn(
          'Aprobacion automatica de transferencias pausada por PEDIDO_TRANSFER_APPROVAL_ENABLED',
        );
        this.transferApprovalPauseLogged = true;
      }
      return;
    }

    this.transferApprovalPauseLogged = false;

    const pendientes = await this.pedidoRepo.find({
      where: {
        estado: In(['PENDIENTE', 'ERROR_STOCK']),
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
        const tieneCobro = await this.cobrosService.tieneCobroFacturaDelPedido(
          tipo,
          comprobante,
          pedido,
        );
        if (!tieneCobro) continue;

        await this.pedidoService.aprobarTransferencia(pedido.external_id);
        this.logger.log(
          `[${pedido.external_id}] Pedido transferencia aprobado por cobro registrado`,
        );
      } catch (e) {
        this.logger.error(
          `[${pedido.external_id}] Error en aprobación automática: ${e?.message || e}`,
        );
      }
    }
  }

  private isTransferApprovalEnabled(): boolean {
    const value =
      process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED?.trim().toLowerCase();

    return !['false', '0', 'no', 'off'].includes(value ?? '');
  }

  private isCancellationWindowOpen(now = new Date()): boolean {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);

    if (weekday === 'Sat' || weekday === 'Sun') return false;
    if (weekday === 'Mon') return hour >= 12;

    return true;
  }
}
