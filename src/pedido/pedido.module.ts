// src/pedido/pedido.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidoService } from './pedido.service';
import { PedidoController } from './pedido.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidoItem } from './entities/pedido-item.entity';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { StkAtributo } from 'src/stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from 'src/stk-item/entities/stk-atributo-nodo.entity';
import { StkExistenciaModule } from 'src/stk-existencia/stk-existencia.module';
import { VtaComprobanteModule } from 'src/vta-comprobante/vta-comprobante.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { VtaComprobanteItemModule } from 'src/vta-comprobante-item/vta-comprobante-item.module';
import { PedidoExpirationService } from './pedido-expiration.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { CuponModule } from 'src/cupon/cupon.module';
import { VtaClienteModule } from 'src/vta_cliente/vta_cliente.module';
import { DeliveryConfigModule } from '../delivery-config/delivery-config.module';

@Module({
  imports: [
    // 👇 Se indica la conexión 'back' para la BD propia
    TypeOrmModule.forFeature([Pedido, PedidoItem], 'back'),
    TypeOrmModule.forFeature([StkItem, StkAtributo, StkAtributoNodo]), // conexión default (Nacional)
    forwardRef(() => StkExistenciaModule),
    forwardRef(() => VtaComprobanteModule),
    forwardRef(() => VtaComprobanteItemModule),
    MailerModule,
    WhatsappModule,
    TelegramModule,
    CuponModule,
    VtaClienteModule,
    DeliveryConfigModule,
  ],
  controllers: [PedidoController],
  providers: [PedidoService, PedidoExpirationService],
  exports: [PedidoService],
})
export class PedidoModule {}
