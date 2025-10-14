import { IsOptional, IsString, IsBoolean, Length, IsEmail } from 'class-validator';

export class CreateVtaClienteDto {
  @IsString()
  @Length(1, 20)
  id: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5)
  tipoDocumento?: string;

  @IsOptional()
  @IsString()
  @Length(0, 15)
  numeroDocumento?: string;

  @IsOptional()
  @IsEmail()
  @Length(0, 256)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  localidad?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  provincia?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  empresa?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5)
  condicionIva?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  lista?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  rubro?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
