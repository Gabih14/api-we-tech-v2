// src/pedido/pedido.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from './entities/pedido.entity';
import { PedidoItem } from './entities/pedido-item.entity';
import { PedidoController } from './pedido.controller';
import { PedidoService } from './pedido.service';
import { StkExistenciaModule } from 'src/stk-existencia/stk-existencia.module';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { VtaComprobanteModule } from 'src/vta-comprobante/vta-comprobante.module';


@Module({
  imports: [TypeOrmModule.forFeature([Pedido, PedidoItem, StkItem]), forwardRef(() => VtaComprobanteModule),StkExistenciaModule],
  controllers: [PedidoController],
  providers: [PedidoService],
  exports: [PedidoService],
})
export class PedidoModule {}
  