import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const requiredTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const nullableTrim = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const result = value.trim();
  return result === '' ? null : result;
};

export class CreateAtributoDto {
  @Transform(requiredTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'id solo puede contener letras, numeros, guion y guion bajo',
  })
  id: string;

  @Transform(requiredTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nombre: string;

  @Transform(requiredTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  clase: string;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString()
  @MaxLength(50)
  grupoAtributo?: string | null;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString()
  @MaxLength(50)
  subgrupoAtributo?: string | null;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString()
  @MaxLength(50)
  grupo?: string | null;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString()
  @MaxLength(50)
  subgrupo?: string | null;

  @IsOptional()
  @IsInt()
  orden?: number | null;
}
