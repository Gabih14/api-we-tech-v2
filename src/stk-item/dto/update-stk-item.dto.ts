import { PartialType } from '@nestjs/mapped-types';
import { CreateStkItemDto } from './create-stk-item.dto';

export class UpdateStkItemDto extends PartialType(CreateStkItemDto) {}
