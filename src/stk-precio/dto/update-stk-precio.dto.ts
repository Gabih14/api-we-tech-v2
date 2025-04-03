import { PartialType } from '@nestjs/mapped-types';
import { CreateStkPrecioDto } from './create-stk-precio.dto';

export class UpdateStkPrecioDto extends PartialType(CreateStkPrecioDto) {}
