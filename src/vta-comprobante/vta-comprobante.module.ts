import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtaComprobanteService } from './vta-comprobante.service';
import { VtaComprobanteController } from './vta-comprobante.controller';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { VtaComprobanteItemModule } from 'src/vta-comprobante-item/vta-comprobante-item.module';
import { VtaClienteModule } from 'src/vta_cliente/vta_cliente.module';
import { VtaComprobanteAsientoModule } from 'src/vta_comprobante_asiento/vta_comprobante_asiento.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VtaComprobante]),
    VtaComprobanteItemModule,
    VtaClienteModule,
    VtaComprobanteAsientoModule,
  ],
  controllers: [VtaComprobanteController],
  providers: [VtaComprobanteService],
  exports: [VtaComprobanteService],
})
export class VtaComprobanteModule {}
