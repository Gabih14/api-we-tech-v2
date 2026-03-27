import { Module } from '@nestjs/common';
import { DeliveryConfigService } from './delivery_config.service';
import { DeliveryConfigController } from './delivery_config.controller';

@Module({
  controllers: [DeliveryConfigController],
  providers: [DeliveryConfigService],
})
export class DeliveryConfigModule {}
