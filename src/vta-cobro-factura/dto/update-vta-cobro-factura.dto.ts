import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaCobroFacturaDto } from './create-vta-cobro-factura.dto';

export class UpdateVtaCobroFacturaDto extends PartialType(CreateVtaCobroFacturaDto) {}
