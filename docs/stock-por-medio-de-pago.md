# Stock por medio de pago

## Regla de propiedad

- **Online:** la API reserva, confirma, libera y compensa stock en
  `stk_existencia`.
- **Transferencia:** la API reserva al crear el pedido y libera esa reserva si
  el pedido se cancela. Cuando la transferencia se aprueba, el ERP es
  responsable de procesar la existencia y la reserva.

## Matriz del flujo

| Operación                    | Online                                    | Transferencia                                       |
| ---------------------------- | ----------------------------------------- | --------------------------------------------------- |
| Crear pedido                 | Reserva stock y guarda `deposito_reserva` | Reserva stock y guarda `deposito_reserva`           |
| Aprobar pago                 | Resta la reserva y la existencia física   | No modifica `stk_existencia`; solo marca `APROBADO` |
| Cancelar o expirar           | Libera la reserva                         | Libera la reserva                                   |
| Compensar un error posterior | Restaura existencia y reserva             | No modifica existencias                             |
| Registrar la venta en el ERP | Crea el comprobante al aprobar            | Crea el comprobante pendiente al crear el pedido    |

## Motivo

Los comprobantes de transferencia generados en el ERP ya expresan su impacto
físico mediante `vta_comprobante_item.cantidad_stk`. Confirmar nuevamente ese
stock desde la API produce un doble movimiento: el ERP reduce `cantidad` y la
API intenta volver a reducirla al detectar el cobro.

Por ese motivo, `aprobarTransferencia` conserva las validaciones de pedido,
comprobante y cobro, pero no invoca ningún método de `StkExistenciaService`.
La reserva se mantiene durante la aprobación para que el sistema de gestión
la procese. Si la transferencia se cancela o expira antes de aprobarse, la API
sí libera la reserva.

## Pedidos anteriores al cambio

Una transferencia creada antes de esta regla puede estar en `ERROR_STOCK` por
el intento anterior de confirmar existencia desde la API. Al reintentarse, la
API conservará su reserva y el ERP deberá procesarla al aprobar la operación.

Los pedidos en `ERROR_STOCK` con un cobro válido pueden reintentarse: se
marcarán `APROBADO` sin consultar ni modificar `stk_existencia`.
