import { IsOptional, IsString } from 'class-validator';

export class GetDistanceDto {
  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @IsOptional()
  @IsString()
  codigo_postal?: string;
}
