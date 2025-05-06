import { PartialType } from '@nestjs/mapped-types';
import { CreateStkFamiliaDto } from './create-stk_familia.dto';

export class UpdateStkFamiliaDto extends PartialType(CreateStkFamiliaDto) {}
