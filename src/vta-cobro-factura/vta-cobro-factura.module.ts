import { Module } from '@nestjs/common';
import { VtaCobroFacturaService } from './vta-cobro-factura.service';
import { VtaCobroFacturaController } from './vta-cobro-factura.controller';

@Module({
  controllers: [VtaCobroFacturaController],
  providers: [VtaCobroFacturaService],
})
export class VtaCobroFacturaModule {}
