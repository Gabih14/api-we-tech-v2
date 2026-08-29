import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkExistenciaService } from './stk-existencia.service';
import { StkExistenciaController } from './stk-existencia.controller';
import { StkExistencia } from './entities/stk-existencia.entity';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { PedidoItem } from 'src/pedido/entities/pedido-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StkExistencia]),
    TypeOrmModule.forFeature([Pedido, PedidoItem], 'back'),
  ],
  controllers: [StkExistenciaController],
  providers: [StkExistenciaService],
  exports: [StkExistenciaService],
})
export class StkExistenciaModule {}
