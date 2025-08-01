// src/vta-comprobante/dto/create-vta-comprobante.dto.ts
import { IsOptional, IsString, IsNumber, IsDate, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVtaComprobanteDto {
  @IsString()
  tipo: string;

  @IsString()
  comprobante: string;

  @IsOptional()
  @IsString()
  cliente?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fecha?: Date;

  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  razon_social?: string;

  @IsOptional()
  @IsString()
  tipo_documento?: string;

  @IsOptional()
  @IsString()
  numero_documento?: string;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  nogravado?: number;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsNumber()
  cobrado?: number;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsBoolean()
  mail?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
