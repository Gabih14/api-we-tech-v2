import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

export class CreateStkDepositoDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  existenciaLote?: boolean;

  @IsOptional()
  @IsString()
  loteExistencia?: string;

  @IsOptional()
  @IsNumber()
  orden?: number;
}
