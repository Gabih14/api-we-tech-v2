import { IsInt, IsNumber, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVtaComprobanteItemDto {
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  comprobante: string;

  @IsInt()
  @IsNotEmpty()
  linea: number; // 👈 Clave primaria compuesta

  @IsInt()
  @IsNotEmpty()
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  precio: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  importe: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  ajuste?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  ajuste_neto?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  ajuste_iva?: number;

  @IsString()
  @IsNotEmpty()
  itemId: string; // 👈 En tu entidad `StkItem`, el ID es tipo varchar
}
