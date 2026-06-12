import { PartialType } from '@nestjs/mapped-types';
import { CreateColorGroupDto } from './create-color-group.dto';

export class UpdateColorGroupDto extends PartialType(CreateColorGroupDto) {}
