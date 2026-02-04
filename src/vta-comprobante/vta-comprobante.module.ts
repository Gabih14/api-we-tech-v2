// src/vta-comprobante/vta-comprobante.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VtaComprobanteService } from './vta-comprobante.service';
import { VtaComprobanteController } from './vta-comprobante.controller';
import { VtaComprobante } from './entities/vta-comprobante.entity';

import { VtaComprobanteItemModule } from 'src/vta-comprobante-item/vta-comprobante-item.module';
import { VtaClienteModule } from 'src/vta_cliente/vta_cliente.module';
import { VtaComprobanteAsientoModule } from 'src/vta_comprobante_asiento/vta_comprobante_asiento.module';

import { CobrosService } from './cobros.service';
import { VtaCobro } from 'src/vta-cobro/entities/vta-cobro.entity';
import { VtaCobroMedio } from 'src/vta-cobro-medio/entities/vta-cobro-medio.entity';
import { VtaCobroFactura } from 'src/vta-cobro-factura/entities/vta-cobro-factura.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VtaComprobante,
      VtaCobro,
      VtaCobroMedio,
      VtaCobroFactura,
    ]),
    VtaComprobanteItemModule,
    VtaClienteModule,
    VtaComprobanteAsientoModule,
  ],
  controllers: [VtaComprobanteController],
  providers: [VtaComprobanteService, CobrosService],
  exports: [VtaComprobanteService, CobrosService],
})
export class VtaComprobanteModule {}
