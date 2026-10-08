import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const normalizeClassification = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class UpdateStkAtributoClasificacionDto {
  @IsOptional()
  @Transform(normalizeClassification)
  @IsString()
  @MaxLength(50)
  grupo?: string | null;

  @IsOptional()
  @Transform(normalizeClassification)
  @IsString()
  @MaxLength(50)
  subgrupo?: string | null;
}
