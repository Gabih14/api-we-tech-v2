import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtaComprobanteService } from './vta-comprobante.service';
import { VtaComprobanteController } from './vta-comprobante.controller';
import { VtaComprobante } from './entities/vta-comprobante.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VtaComprobante])],
  controllers: [VtaComprobanteController],
  providers: [VtaComprobanteService],
  exports: [VtaComprobanteService],
})
export class VtaComprobanteModule {}
