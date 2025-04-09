import { IsNotEmpty, IsOptional, IsString, IsNumber } from "class-validator";

export class CreateBasMonedaDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  simbolo?: string;

  @IsString()
  @IsOptional()
  simbolos?: string;

  @IsNumber()
  @IsOptional()
  cotizacion?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsOptional()
  icono?: Buffer;

  @IsNumber()
  @IsOptional()
  orden?: number;
}
