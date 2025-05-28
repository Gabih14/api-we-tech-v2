// src/pedido/dto/create-pedido.dto.ts
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PedidoItemDto {
  @IsString()
  nombre: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  precio_unitario: number;
}

export class CreatePedidoDto {
  @IsString()
  cliente_cuit: string;

  @IsString()
  cliente_nombre: string;

  @IsString()
  external_id: string;

  @IsNumber()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PedidoItemDto)
  productos: PedidoItemDto[];
}
