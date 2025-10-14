import { PartialType } from '@nestjs/mapped-types';
import { CreateVtaClienteDto } from './create-vta_cliente.dto';

export class UpdateVtaClienteDto extends PartialType(CreateVtaClienteDto) {}
