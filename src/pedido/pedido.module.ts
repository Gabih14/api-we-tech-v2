// src/pedido/pedido.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidoService } from './pedido.service';
import { PedidoController } from './pedido.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidoItem } from './entities/pedido-item.entity';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { StkExistenciaModule } from 'src/stk-existencia/stk-existencia.module';
import { VtaComprobanteModule } from 'src/vta-comprobante/vta-comprobante.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { VtaComprobanteItemModule } from 'src/vta-comprobante-item/vta-comprobante-item.module';
import { PedidoExpirationService } from './pedido-expiration.service';

@Module({
  imports: [
    // 👇 Se indica la conexión 'back' para la BD propia
    TypeOrmModule.forFeature([Pedido, PedidoItem], 'back'),
    TypeOrmModule.forFeature([StkItem]), // Esta sigue en la conexión default (Nacional)
    forwardRef(() => StkExistenciaModule),
    forwardRef(() => VtaComprobanteModule),
    forwardRef(() => VtaComprobanteItemModule),
    MailerModule
  ],
  controllers: [PedidoController],
  providers: [PedidoService, PedidoExpirationService],
  exports: [PedidoService],
})
export class PedidoModule {}
