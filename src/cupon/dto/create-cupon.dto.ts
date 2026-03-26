import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentajeDescuento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentajeDescuentoTarjeta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentajeDescuentoTransferencia?: number;

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