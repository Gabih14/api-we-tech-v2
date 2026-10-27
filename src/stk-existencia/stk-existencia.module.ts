import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkExistenciaService } from './stk-existencia.service';
import { StkExistenciaController } from './stk-existencia.controller';
import { StkExistencia } from './entities/stk-existencia.entity';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { PedidoItem } from 'src/pedido/entities/pedido-item.entity';
import { StockReserva } from './entities/stock-reserva.entity';
import { StockReservaItem } from './entities/stock-reserva-item.entity';
import { StockReservaEvento } from './entities/stock-reserva-evento.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StkExistencia,
      StockReserva,
      StockReservaItem,
      StockReservaEvento,
    ]),
    TypeOrmModule.forFeature([Pedido, PedidoItem], 'back'),
  ],
  controllers: [StkExistenciaController],
  providers: [StkExistenciaService],
  exports: [StkExistenciaService],
})
export class StkExistenciaModule {}
