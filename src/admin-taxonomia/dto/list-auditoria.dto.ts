import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export enum AuditSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export class ListAuditoriaDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  arbol?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  clase?: string;
}
