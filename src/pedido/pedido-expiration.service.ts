import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Pedido } from './entities/pedido.entity';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';

@Injectable()
export class PedidoExpirationService {
  private readonly logger = new Logger(PedidoExpirationService.name);

  constructor(
    @InjectRepository(Pedido, 'back')
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly existenciaService: StkExistenciaService,
  ) {}

  async run(ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30)) {
    const cutoff = new Date(Date.now() - ttlMin * 60_000);

    const pendientes = await this.pedidoRepo.find({
      where: { estado: 'PENDIENTE', creado: LessThan(cutoff) },
      relations: ['productos'],
    });

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
}
