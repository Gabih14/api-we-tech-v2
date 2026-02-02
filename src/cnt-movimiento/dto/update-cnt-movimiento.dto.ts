import { PartialType } from '@nestjs/mapped-types';
import { CreateCntMovimientoDto } from './create-cnt-movimiento.dto';

export class UpdateCntMovimientoDto extends PartialType(CreateCntMovimientoDto) {}
