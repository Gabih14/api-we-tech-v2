import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { MapsModule } from './maps/maps.module';
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // 🟡 Conexión Nacional Software (wetechv2)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: config.get<string>('ROOT_PASSWORD'),
        database: 'wetechv2',
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),

    // 🔵 Conexión a BD propia (we_tech_back)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      name: 'back', // 👈 nombre para identificar esta conexión
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: config.get<string>('ROOT_PASSWORD'),
        database: 'we_tech_back',
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
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
    VtaComprobanteItemModule,
    MailerModule,
  ],
})
export class AppModule {}
