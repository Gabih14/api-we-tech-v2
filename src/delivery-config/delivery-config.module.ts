import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryConfigController } from './delivery-config.controller';
import { DeliveryConfigService } from './delivery-config.service';
import { DeliveryConfig } from './entities/delivery-config.entity';
import { DeliveryConfigDepartamento } from './entities/delivery-config-departamento.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [DeliveryConfig, DeliveryConfigDepartamento],
      'back',
    ),
    TypeOrmModule.forFeature([StkItem]),
  ],
  controllers: [DeliveryConfigController],
  providers: [DeliveryConfigService],
  exports: [DeliveryConfigService],
})
export class DeliveryConfigModule {}
