import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkItemModule } from './stk-item/stk-item.module';
import { StkExistenciaModule } from './stk-existencia/stk-existencia.module';
import { StkDepositoModule } from './stk-deposito/stk-deposito.module';
import { StkPrecioModule } from './stk-precio/stk-precio.module';
import { BasMonedaModule } from './bas-moneda/bas-moneda.module';
import { SysImageModule } from './sys_image/sys_image.module';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'mysql',
    database: 'wetech',
    autoLoadEntities: true,
    synchronize: true,
  }),StkItemModule, StkExistenciaModule, StkDepositoModule, StkPrecioModule, BasMonedaModule, SysImageModule],

})
export class AppModule {}
