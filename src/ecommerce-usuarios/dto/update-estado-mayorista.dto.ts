import { IsEnum } from 'class-validator';
import { EstadoMayorista } from '../entities/ecommerce-usuario.entity';

export class UpdateEstadoMayoristaDto {
  @IsEnum(EstadoMayorista)
  estado: EstadoMayorista;
}
