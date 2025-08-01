import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaComprobanteDto } from './create-vta-comprobante.dto';

export class UpdateVtaComprobanteDto extends PartialType(CreateVtaComprobanteDto) {}
