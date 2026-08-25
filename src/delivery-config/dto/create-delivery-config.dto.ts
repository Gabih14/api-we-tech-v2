import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeliveryConfigDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(/\S/, { message: 'telefono no puede estar vacio' })
  telefono?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/\S/, { message: 'api_key no puede estar vacia' })
  api_key?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  item?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departamento?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  kms?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
