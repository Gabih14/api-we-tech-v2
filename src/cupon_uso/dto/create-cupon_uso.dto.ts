import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCuponUsoDto {
  @IsString()
  cupon_id: string;

  @IsString()
  cuit: string;

  @IsOptional()
  @IsInt()
  pedido_id?: number;
}
