import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaComprobanteAsientoDto } from './create-vta_comprobante_asiento.dto';

export class UpdateVtaComprobanteAsientoDto extends PartialType(CreateVtaComprobanteAsientoDto) {}
