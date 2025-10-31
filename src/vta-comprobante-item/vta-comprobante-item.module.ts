import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtaComprobanteItemService } from './vta-comprobante-item.service';
import { VtaComprobanteItemController } from './vta-comprobante-item.controller';
import { VtaComprobanteItem } from './entities/vta-comprobante-item.entity';
import { VtaComprobante } from '../vta-comprobante/entities/vta-comprobante.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VtaComprobanteItem, VtaComprobante, StkItem])],
  controllers: [VtaComprobanteItemController],
  providers: [VtaComprobanteItemService],
  exports: [VtaComprobanteItemService],
})
export class VtaComprobanteItemModule {}
