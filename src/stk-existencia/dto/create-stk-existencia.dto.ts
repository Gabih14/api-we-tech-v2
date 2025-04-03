import { IsString, IsOptional, IsNumberString, Length } from 'class-validator';

export class CreateStkExistenciaDto {
  @IsString()
  @Length(1, 20)
  item: string;

  @IsString()
  @Length(1, 20)
  deposito: string;

  @IsOptional()
  @IsNumberString()
  cantidad?: string;

  @IsOptional()
  @IsNumberString()
  produccion?: string;

  @IsOptional()
  @IsNumberString()
  comprometido?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  ubicacion?: string;
}
