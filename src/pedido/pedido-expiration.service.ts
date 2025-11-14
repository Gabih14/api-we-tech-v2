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

  // Ejecuta la expiración manualmente; se puede invocar desde jobs o controladores
  async run(ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30)) {
    const cutoff = new Date(Date.now() - ttlMin * 60_000);

    const pendientes = await this.pedidoRepo.find({
      where: { estado: 'PENDIENTE', creado: LessThan(cutoff) },
      relations: ['productos'],
    });

    if (!pendientes.length) return { expirados: 0 };

    let expirados = 0;
    for (const pedido of pendientes) {
      try {
        for (const p of pedido.productos) {
          await this.existenciaService.liberarStock(p.nombre, p.cantidad, 'DEPOSITO');
        }
        pedido.estado = 'CANCELADO';
        await this.pedidoRepo.save(pedido);
        expirados++;
      } catch (e) {
        this.logger.error(`Error expirando ${pedido.external_id}: ${e?.message || e}`);
      }
    }

    return { expirados };
  }

  // Corre cada 10 minutos por defecto
  @Cron(process.env.PEDIDO_TTL_CRON || '*/10 * * * *')
  async scheduledRun() {
    const ttlMin = Number(process.env.PEDIDO_TTL_MIN || 30);
    const { expirados } = await this.run(ttlMin);
    if (expirados > 0) {
      this.logger.log(`Pedidos expirados y stock liberado: ${expirados}`);
    }
  }
}
