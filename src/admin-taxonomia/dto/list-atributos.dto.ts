import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const booleanValue = ({ value }: { value: unknown }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ListAtributosDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  clase?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  grupoAtributo?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  subgrupoAtributo?: string;

  @IsOptional()
  @Transform(booleanValue)
  @IsBoolean()
  usado?: boolean;
}
