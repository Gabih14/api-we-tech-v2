import { PedidoEstado } from '../entities/pedido.entity';

export class GetPedidosDashboardDto {
  estado?: PedidoEstado;
  from?: string;
  to?: string;
  q?: string;
  metodo_pago?: 'online' | 'transfer';
  delivery_method?: 'pickup' | 'shipping';
  page?: number | string;
  limit?: number | string;
}
