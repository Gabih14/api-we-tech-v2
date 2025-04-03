import { PartialType } from '@nestjs/mapped-types';
import { CreateStkDepositoDto } from './create-stk-deposito.dto';

export class UpdateStkDepositoDto extends PartialType(CreateStkDepositoDto) {}
