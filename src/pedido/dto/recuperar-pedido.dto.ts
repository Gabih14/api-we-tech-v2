import { IsIn } from 'class-validator';

export class RecuperarPedidoDto {
  @IsIn(['PENDIENTE', 'APROBADO'])
  estado: 'PENDIENTE' | 'APROBADO';
}
