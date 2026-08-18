# Stock por medio de pago

## Regla de propiedad

- **Online:** la API es responsable de reservar, confirmar, liberar y
  compensar stock en `stk_existencia`.
- **Transferencia:** el ERP es la única fuente de verdad para los movimientos
  de stock. La API no escribe en `stk_existencia` durante ninguna transición
  del pedido.

## Matriz del flujo

| Operación                    | Online                                    | Transferencia                                     |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Crear pedido                 | Reserva stock y guarda `deposito_reserva` | No reserva ni modifica existencias                |
| Aprobar pago                 | Resta la reserva y la existencia física   | Solo valida el cobro y marca el pedido `APROBADO` |
| Cancelar o expirar           | Libera la reserva                         | No modifica existencias                           |
| Compensar un error posterior | Restaura existencia y reserva             | No modifica existencias                           |
| Registrar la venta en el ERP | Crea el comprobante al aprobar            | Crea el comprobante pendiente al crear el pedido  |

## Motivo

Los comprobantes de transferencia generados en el ERP ya expresan su impacto
físico mediante `vta_comprobante_item.cantidad_stk`. Confirmar nuevamente ese
stock desde la API produce un doble movimiento: el ERP reduce `cantidad` y la
API intenta volver a reducirla al detectar el cobro.

Por ese motivo, `aprobarTransferencia` conserva las validaciones de pedido,
comprobante y cobro, pero no invoca ningún método de `StkExistenciaService`.
La misma exclusión se aplica al alta y a la cancelación de transferencias.

## Pedidos anteriores al cambio

Una transferencia creada antes de esta regla puede conservar valores en
`comprometido` generados por la API anterior. El nuevo flujo no los corrige
automáticamente porque hacerlo sería otro movimiento sobre existencias. Esos
casos deben reconciliarse una sola vez desde el ERP o mediante un procedimiento
controlado antes de considerar cerrado el incidente.

Los pedidos en `ERROR_STOCK` con un cobro válido pueden reintentarse: se
marcarán `APROBADO` sin consultar ni modificar `stk_existencia`.
