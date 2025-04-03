import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StkExistencia } from '../../stk-existencia/entities/stk-existencia.entity';
import { StkPrecio } from '../../stk-precio/entities/stk-precio.entity';

export class CreateStkItemDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  presentacion?: string;

  @IsOptional()
  @IsString()
  tipo?: 'PT' | 'SE' | 'MP' | 'CP' | 'BU' | 'S' | 'C';

  @IsOptional()
  @IsString()
  grupo?: string;

  @IsOptional()
  @IsString()
  subgrupo?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StkExistencia)
  stkExistencias?: StkExistencia[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StkPrecio)
  stkPrecios?: StkPrecio[];
}
