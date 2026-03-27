import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryConfigDto } from './create-delivery_config.dto';

export class UpdateDeliveryConfigDto extends PartialType(CreateDeliveryConfigDto) {}
