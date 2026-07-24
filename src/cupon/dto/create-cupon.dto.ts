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
  IsIn,
} from 'class-validator';

const CUPON_CATEGORIAS_PERMITIDAS = [
  'general',
  'filamento',
  'impresora',
  'repuesto',
] as const;

export class CreateCuponDto {
  @IsString()
  @Type(() => String)
  id: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  max_usos?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxUsosPorCuit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  max_usos_por_cuit?: number;

  @IsOptional()
  @IsString()
  cuitHabilitado?: string | null;

  @IsOptional()
  @IsString()
  cuit_habilitado?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(CUPON_CATEGORIAS_PERMITIDAS)
  categoriaAplicable?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(CUPON_CATEGORIAS_PERMITIDAS)
  categoria_aplicable?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentajeDescuento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentajeDescuentoTarjeta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
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
