import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateStkFamiliaDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  versionFormula?: string;

  @IsOptional()
  @IsString()
  versionReceta?: string;

  @IsOptional()
  @IsString()
  versionEspecif?: string;

  @IsOptional()
  @IsString()
  versionProceso?: string;

  @IsOptional()
  @IsInt()
  orden?: number;
}
