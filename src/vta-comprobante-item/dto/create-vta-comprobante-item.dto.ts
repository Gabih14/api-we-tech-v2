import { IsInt, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateVtaComprobanteItemDto {
  @IsInt()
  @IsNotEmpty()
  cantidad: number;

  @IsNumber()
  @IsNotEmpty()
  precioUnitario: number;

  @IsNumber()
  @IsNotEmpty()
  total: number;

  @IsNotEmpty()
  tipo: string;

  @IsNotEmpty()
  comprobante: string;

  @IsInt()
  @IsNotEmpty()
  itemId: number;
}

