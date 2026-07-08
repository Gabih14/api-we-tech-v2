import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEsperaDto {
  @IsString()
  @MaxLength(20)
  producto_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cliente_id?: string;

  @IsString()
  @MaxLength(150)
  cliente_nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cliente_tel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}
