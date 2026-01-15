import { PartialType } from '@nestjs/mapped-types';
import { CreateCuponUsoDto } from './create-cupon_uso.dto';

export class UpdateCuponUsoDto extends PartialType(CreateCuponUsoDto) {}
