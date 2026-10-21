import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export enum TipoArbol {
  PADRE = 'padre',
  STANDALONE = 'standalone',
  TODOS = 'todos',
}

export class ListArbolesDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  marca?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  material?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  submaterial?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  grupoWeb?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  sublinea?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  familia?: string;

  @IsOptional()
  @IsEnum(TipoArbol)
  tipo?: TipoArbol;
}
