import { IsInt, IsNumber, IsNotEmpty, IsString } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  itemId: string; // 👈 En tu entidad `StkItem`, el ID es tipo varchar
}
