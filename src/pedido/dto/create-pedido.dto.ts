import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ProductoDto {
  @IsString()
  nombre: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  precio_unitario: number;
}

export class CreatePedidoDto {
  @IsString()
  cliente_nombre: string;

  @IsString()
  cliente_cuit: string;

  @IsNumber()
  total: number;

  @IsEmail()
  email: string;

  @IsString()
  telefono: string;

  @IsString()
  calle: string;

  @IsString()
  ciudad: string;

  @IsString()
  region: string;

  @IsString()
  pais: string;

  @IsString()
  codigo_postal: string;

  @IsString()
  mobile: string;

  @IsArray()
  productos: ProductoDto[];
}
