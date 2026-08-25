import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryConfigDto } from './create-delivery-config.dto';

export class UpdateDeliveryConfigDto extends PartialType(
  CreateDeliveryConfigDto,
) {}
