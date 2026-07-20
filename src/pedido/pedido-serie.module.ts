import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkExistenciaModule } from 'src/stk-existencia/stk-existencia.module';
import { PedidoItemConfig } from './entities/pedido-item-config.entity';
import { PedidoItemSerie } from './entities/pedido-item-serie.entity';
import { StkNumeroSerie } from './entities/stk-numero-serie.entity';
import { VtaSerieItem } from './entities/vta-serie-item.entity';
import { PedidoSerieService } from './pedido-serie.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedidoItemConfig, PedidoItemSerie], 'back'),
    TypeOrmModule.forFeature([StkNumeroSerie, VtaSerieItem]),
    forwardRef(() => StkExistenciaModule),
  ],
  providers: [PedidoSerieService],
  exports: [PedidoSerieService],
})
export class PedidoSerieModule {}
