import { IsString, IsOptional, IsBoolean, IsNumber } from "class-validator";

export class CreateStkPrecioDto {
  @IsString()
  lista: string;

  @IsString()
  item: string;

  @IsOptional()
  @IsString() // Se mantiene string porque en la entidad es string | null
  precio?: string;

  @IsOptional()
  @IsString()
  precioVta?: string;

  @IsOptional()
  @IsString()
  precioAux?: string;

  @IsOptional()
  @IsString()
  ganancia?: string;

  @IsOptional()
  @IsString()
  utilidad?: string;

  @IsOptional()
  @IsString()
  monedaId?: string; // Ahora es el ID de la moneda en lugar de un simple string

  @IsOptional()
  @IsBoolean()
  ivainc?: boolean;

  @IsOptional()
  @IsString()
  alicuota?: string;

  @IsOptional()
  @IsString()
  fecha?: string;
}
