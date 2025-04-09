import { PartialType } from '@nestjs/mapped-types';
import { CreateBasMonedaDto } from './create-bas-moneda.dto';

export class UpdateBasMonedaDto extends PartialType(CreateBasMonedaDto) {}
