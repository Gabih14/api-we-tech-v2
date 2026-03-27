import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateDeliveryConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  telefono: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  api_key: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}