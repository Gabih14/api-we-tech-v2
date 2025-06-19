import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StkItemModule } from './stk-item/stk-item.module';
import { StkExistenciaModule } from './stk-existencia/stk-existencia.module';
import { StkDepositoModule } from './stk-deposito/stk-deposito.module';
import { StkPrecioModule } from './stk-precio/stk-precio.module';
import { BasMonedaModule } from './bas-moneda/bas-moneda.module';
import { SysImageModule } from './sys_image/sys_image.module';
import { StkFamiliaModule } from './stk_familia/stk_familia.module';
import { PedidoModule } from './pedido/pedido.module';
import { VtaComprobanteModule } from './vta-comprobante/vta-comprobante.module';
import { MapsModule } from './maps/maps.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'Mysqlmysql1',
      database: 'wetech',
      autoLoadEntities: true,
      synchronize: true,
    }),
    StkItemModule,
    StkExistenciaModule,
    StkDepositoModule,
    StkPrecioModule,
    BasMonedaModule,
    SysImageModule,
    StkFamiliaModule,
    PedidoModule,
    VtaComprobanteModule,
    MapsModule,
  ],
})
export class AppModule {}
