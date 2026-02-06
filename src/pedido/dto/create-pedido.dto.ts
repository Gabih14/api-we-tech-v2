import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductoDto {
  @IsString()
  nombre: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  precio_unitario: number;
}

export class BillingAddressDto {
  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsString()
  city: string;

  @IsString()
  region: string;

  @IsString()
  country: string;

  @IsString()
  postal_code: string;
}

export class CreatePedidoDto {
  @IsString()
  cliente_nombre: string;

  @IsString()
  cliente_cuit: string;

  @IsEmail()
  cliente_mail: string;

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
  @ValidateNested({ each: true })
  @Type(() => ProductoDto)
  productos: ProductoDto[];

  @ValidateNested()
  @Type(() => BillingAddressDto)
  billing_address: BillingAddressDto;

  @IsString()
  @IsIn(['pickup', 'shipping'])
  tipo_envio: 'pickup' | 'shipping';

  @IsNumber()
  costo_envio: number;

  @IsString()
  observaciones?: string;

  // Opcionales para cupones de descuento
  @IsOptional()
  @IsNumber()
  descuento_cupon?: number;

  @IsOptional()
  @IsString()
  codigo_cupon?: string;

  @IsOptional()
  @IsString()
  @IsIn(['online', 'transfer'])
  metodo_pago?: 'online' | 'transfer';
}
