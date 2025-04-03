import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateStkPrecioDto {
  @IsString()
  lista: string;

  @IsString()
  item: string;

  @IsOptional()
  @IsString() // Debe ser string porque en la entidad está como "string | null"
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
  moneda?: string;

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
