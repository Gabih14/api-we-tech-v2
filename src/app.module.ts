import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkItemModule } from './stk-item/stk-item.module';
import { StkExistenciaModule } from './stk-existencia/stk-existencia.module';
import { StkDepositoModule } from './stk-deposito/stk-deposito.module';
import { StkPrecioModule } from './stk-precio/stk-precio.module';
import { BasMonedaModule } from './bas-moneda/bas-moneda.module';
import { SysImageModule } from './sys_image/sys_image.module';
import { StkFamiliaModule } from './stk_familia/stk_familia.module';
import { PedidoModule } from './pedido/pedido.module';
import { VtaComprobanteModule } from './vta-comprobante/vta-comprobante.module';
import { VtaComprobanteItemModule } from './vta-comprobante-item/vta-comprobante-item.module';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'mysql',
    database: 'wetech',
    autoLoadEntities: true,
    synchronize: false,
  }),StkItemModule, StkExistenciaModule, StkDepositoModule, StkPrecioModule, BasMonedaModule, SysImageModule, StkFamiliaModule, PedidoModule, VtaComprobanteModule, VtaComprobanteItemModule],

})
export class AppModule {}
