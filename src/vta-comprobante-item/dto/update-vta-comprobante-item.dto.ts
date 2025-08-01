import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaComprobanteItemDto } from './create-vta-comprobante-item.dto';

export class UpdateVtaComprobanteItemDto extends PartialType(CreateVtaComprobanteItemDto) {}
