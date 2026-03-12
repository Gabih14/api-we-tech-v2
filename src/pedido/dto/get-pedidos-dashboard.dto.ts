export class GetPedidosDashboardDto {
  estado?: 'PENDIENTE' | 'APROBADO' | 'CANCELADO';
  from?: string;
  to?: string;
  q?: string;
  metodo_pago?: 'online' | 'transfer';
  delivery_method?: 'pickup' | 'shipping';
  page?: number | string;
  limit?: number | string;
}