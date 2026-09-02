import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Pedido } from './entities/pedido.entity';
import { CobrosService } from 'src/vta-comprobante/cobros.service';
import { PedidoService } from './pedido.service';

type BusinessLocalParts = {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

@Injectable()
export class PedidoExpirationService {
  private readonly logger = new Logger(PedidoExpirationService.name);
  private cancellationPauseLogged = false;
  private transferApprovalPauseLogged = false;
  private readonly businessTimezone =
    process.env.PEDIDO_EXPIRATION_TIMEZONE ||
    'America/Argentina/Buenos_Aires';

  constructor(
    @InjectRepository(Pedido, 'back')
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly cobrosService: CobrosService,
    private readonly pedidoService: PedidoService,
  ) {}

  async run(ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30)) {
    const ttlTransferMin = Number(process.env.PEDIDO_TRANSFER_TTL_MIN || 2880); // 48 horas por defecto

    // Buscar pedidos PENDIENTES y filtrar expiracion segun minutos habiles.
    const pendientesOnline = await this.pedidoRepo.find({
      where: {
        estado: 'PENDIENTE',
        metodo_pago: 'online',
      },
      relations: ['productos'],
    });

    const pendientesTransfer = await this.pedidoRepo.find({
      where: {
        estado: 'PENDIENTE',
        metodo_pago: 'transfer',
      },
      relations: ['productos'],
    });

    const now = new Date();
    const pendientes = [...pendientesOnline, ...pendientesTransfer].filter(
      (pedido) =>
        this.isPedidoExpiredByBusinessTime(
          pedido,
          pedido.metodo_pago === 'transfer' ? ttlTransferMin : ttlMin,
          now,
        ),
    );

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
          `[${pedido.external_id}] Error critico durante expiracion: ${e?.message || e}`,
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
          'Cancelacion automatica pausada fuera del horario habil configurado',
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
        `Expiracion completada: ${resultado.expirados}/${resultado.total} cancelados, ${resultado.fallos} errores criticos`,
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
          `[${pedido.external_id}] Error en aprobacion automatica: ${e?.message || e}`,
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
    const local = this.getBusinessLocalParts(now);
    const minuteOfDay = this.getMinutesOfDay(local);

    return (
      this.isBusinessDay(local.weekday) &&
      minuteOfDay >= this.getOpenMinute(local.weekday) &&
      minuteOfDay < this.getCloseMinute()
    );
  }

  private isPedidoExpiredByBusinessTime(
    pedido: Pedido,
    ttlMin: number,
    now: Date,
  ): boolean {
    if (!(pedido.creado instanceof Date) || !Number.isFinite(ttlMin)) {
      return false;
    }

    const expiresAt = this.addBusinessMinutes(pedido.creado, ttlMin);
    return expiresAt.getTime() <= now.getTime();
  }

  private addBusinessMinutes(start: Date, minutes: number): Date {
    let current = new Date(start);
    let remaining = Math.max(0, Math.ceil(minutes));

    while (remaining > 0) {
      current = this.moveToBusinessWindow(current);

      const local = this.getBusinessLocalParts(current);
      const availableToday =
        this.getCloseMinute() - this.getMinutesOfDay(local);

      if (remaining <= availableToday) {
        return new Date(current.getTime() + remaining * 60_000);
      }

      current = new Date(current.getTime() + (availableToday + 1) * 60_000);
      remaining -= availableToday;
    }

    return current;
  }

  private moveToBusinessWindow(date: Date): Date {
    let current = new Date(date);

    for (let i = 0; i < 14 * 24 * 60; i++) {
      const local = this.getBusinessLocalParts(current);
      const minuteOfDay = this.getMinutesOfDay(local);
      const openMinute = this.getOpenMinute(local.weekday);
      const closeMinute = this.getCloseMinute();

      if (!this.isBusinessDay(local.weekday) || minuteOfDay >= closeMinute) {
        current = this.addLocalDaysAtMinute(current, 1, 0);
        continue;
      }

      if (minuteOfDay < openMinute) {
        return this.withLocalMinuteOfDay(current, openMinute);
      }

      return current;
    }

    return current;
  }

  private addLocalDaysAtMinute(
    date: Date,
    days: number,
    minuteOfDay: number,
  ): Date {
    const local = this.getBusinessLocalParts(date);
    const nextUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day + days,
      3,
      0,
      0,
      0,
    );

    return this.withLocalMinuteOfDay(new Date(nextUtc), minuteOfDay);
  }

  private withLocalMinuteOfDay(date: Date, minuteOfDay: number): Date {
    let current = new Date(date);

    for (let i = 0; i < 24 * 60; i++) {
      const local = this.getBusinessLocalParts(current);
      const currentMinute = this.getMinutesOfDay(local);

      if (currentMinute === minuteOfDay) return current;

      current = new Date(
        current.getTime() + Math.sign(minuteOfDay - currentMinute) * 60_000,
      );
    }

    return current;
  }

  private getBusinessLocalParts(date: Date): BusinessLocalParts {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.businessTimezone,
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;

    return {
      weekday: get('weekday') || '',
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hour: Number(get('hour')),
      minute: Number(get('minute')),
    };
  }

  private getMinutesOfDay(local: { hour: number; minute: number }): number {
    return local.hour * 60 + local.minute;
  }

  private isBusinessDay(weekday: string): boolean {
    return weekday !== 'Sat' && weekday !== 'Sun';
  }

  private getOpenMinute(weekday: string): number {
    const defaultHour = weekday === 'Mon' ? 12 : 9;
    return this.getEnvHourAsMinute(
      weekday === 'Mon'
        ? 'PEDIDO_EXPIRATION_MONDAY_OPEN_HOUR'
        : 'PEDIDO_EXPIRATION_OPEN_HOUR',
      defaultHour,
    );
  }

  private getCloseMinute(): number {
    return this.getEnvHourAsMinute('PEDIDO_EXPIRATION_CLOSE_HOUR', 19);
  }

  private getEnvHourAsMinute(name: string, defaultHour: number): number {
    const hour = Number(process.env[name] ?? defaultHour);
    const normalizedHour = Number.isFinite(hour) ? hour : defaultHour;

    return Math.min(Math.max(normalizedHour, 0), 24) * 60;
  }
}
