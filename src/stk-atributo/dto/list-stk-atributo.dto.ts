import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptionalString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ListStkAtributoDto {
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  sinGrupo?: boolean;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  sinSubgrupo?: boolean;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50)
  grupo?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50)
  subgrupo?: string;
}
