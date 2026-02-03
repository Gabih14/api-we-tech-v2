import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaCobroMedioDto } from './create-vta-cobro-medio.dto';

export class UpdateVtaCobroMedioDto extends PartialType(CreateVtaCobroMedioDto) {}
