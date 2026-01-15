import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCuponDto {
  @IsString()
  @Type(() => String)
  id: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsInt()
  max_usos?: number;

  @IsOptional()
  @IsInt()
  maxUsosPorCuit?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaDesde?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaHasta?: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
