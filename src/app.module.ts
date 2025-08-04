import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { MapsModule } from './maps/maps.module';
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [
    // Cargar variables de entorno de forma global
    ConfigModule.forRoot({ isGlobal: true }),

    // 🟡 Conexión Nacional Software (wetechv2)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: +config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),

    // 🔵 Conexión a BD propia (we_tech_back)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      name: 'back',
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('BACK_DB_HOST'),
        port: +config.get<number>('BACK_DB_PORT', 3306),
        username: config.get<string>('BACK_DB_USERNAME'),
        password: config.get<string>('BACK_DB_PASSWORD'),
        database: config.get<string>('BACK_DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
      inject: [ConfigService],
    }),

    // Otros módulos
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
