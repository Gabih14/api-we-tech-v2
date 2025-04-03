import { PartialType } from '@nestjs/mapped-types';
import { CreateStkExistenciaDto } from './create-stk-existencia.dto';

export class UpdateStkExistenciaDto extends PartialType(CreateStkExistenciaDto) {}
