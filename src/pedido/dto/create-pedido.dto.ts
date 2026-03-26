import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsIn,
  IsOptional,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductoDto {
  @IsString()
  nombre: string;

  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precio_unitario: number;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  ajuste_porcentaje?: number;
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
