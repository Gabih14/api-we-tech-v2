import { IsString, IsOptional, IsBoolean } from "class-validator";

export class CreateStkPrecioDto {
  @IsString()
  lista: string;

  @IsString()
  item: string;

  @IsOptional()
  @IsString()
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
  monedaId?: string;

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
