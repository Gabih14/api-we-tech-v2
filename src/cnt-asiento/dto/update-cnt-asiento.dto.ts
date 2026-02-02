import { PartialType } from '@nestjs/mapped-types';
import { CreateCntAsientoDto } from './create-cnt-asiento.dto';

export class UpdateCntAsientoDto extends PartialType(CreateCntAsientoDto) {}
