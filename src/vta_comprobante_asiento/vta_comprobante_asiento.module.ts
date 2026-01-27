import { Module } from '@nestjs/common';
import { VtaComprobanteAsientoService } from './vta_comprobante_asiento.service';
import { VtaComprobanteAsientoController } from './vta_comprobante_asiento.controller';
import { VtaComprobanteAsiento } from './entities/vta_comprobante_asiento.entity';
import { VtaComprobante } from 'src/vta-comprobante/entities/vta-comprobante.entity';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [CntAsiento, CntMovimiento, VtaComprobante, VtaComprobanteAsiento], // 👈 importante
    ),],
  controllers: [VtaComprobanteAsientoController],
  providers: [VtaComprobanteAsientoService],
  exports: [VtaComprobanteAsientoService, TypeOrmModule],
})
export class VtaComprobanteAsientoModule { }
