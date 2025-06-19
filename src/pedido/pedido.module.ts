// src/pedido/pedido.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidoService } from './pedido.service';
import { PedidoController } from './pedido.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidoItem } from './entities/pedido-item.entity'; // 👈 Agregalo
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { StkExistenciaModule } from 'src/stk-existencia/stk-existencia.module';
import { VtaComprobanteModule } from 'src/vta-comprobante/vta-comprobante.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, PedidoItem, StkItem]), // 👈 Agregalo acá también
    forwardRef(() => StkExistenciaModule),
    forwardRef(() => VtaComprobanteModule),
  ],
  controllers: [PedidoController],
  providers: [PedidoService],
  exports: [PedidoService],
})
export class PedidoModule {}
