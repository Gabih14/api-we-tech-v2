import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaCobroDto } from './create-vta-cobro.dto';

export class UpdateVtaCobroDto extends PartialType(CreateVtaCobroDto) {}
