# Stock por medio de pago

## Regla de propiedad

- **Online:** la API reserva, confirma, libera y compensa stock en
  `stk_existencia`.
- **Transferencia:** al crear el pedido, la API aumenta `comprometido` y el
  comprobante `FX` del ERP descuenta la existencia física. Al aprobar, la API
  reduce únicamente `comprometido`. Al cancelar, repone `cantidad` y reduce
  `comprometido`.

## Ejemplo del ciclo de una transferencia

Para un artículo que comienza con `cantidad = 1` y `comprometido = 0`:

| Evento                   | `cantidad` | `comprometido` |
| ------------------------ | ---------- | -------------- |
| Estado inicial           | 1          | 0              |
| Se crea la transferencia | 0          | 1              |
| Se aprueba               | 0          | 0              |

Si, en lugar de aprobarse, la transferencia se cancela desde el estado
`cantidad = 0`, `comprometido = 1`, el resultado es `cantidad = 1` y
`comprometido = 0`.

## Matriz del flujo

| Operación                     | Online                           | Transferencia                                     |
| ----------------------------- | -------------------------------- | ------------------------------------------------- |
| Crear pedido                  | Aumenta `comprometido`           | Aumenta `comprometido`; el `FX` reduce `cantidad` |
| Aprobar pago                  | Reduce existencia y compromiso   | Reduce solo `comprometido`                        |
| Cancelar o expirar            | Reduce solo `comprometido`       | Repone `cantidad` y reduce `comprometido`         |
| Compensar un error al aprobar | Restaura existencia y compromiso | Restaura solo `comprometido`                      |
| Registrar la venta en el ERP  | Crea el comprobante al aprobar   | Crea el comprobante pendiente al crear el pedido  |

## Motivo

Los comprobantes de transferencia generados en el ERP ya expresan su impacto
físico mediante `vta_comprobante_item.cantidad_stk = -cantidad`. Por lo tanto,
volver a descontar `cantidad` durante `aprobarTransferencia` sería un doble
movimiento y puede fallar si una venta presencial dejó la existencia en cero o
en negativo.

La aprobación conserva las validaciones del pedido, comprobante y cobro, pero
solo libera la reserva mediante `liberarStockLote`. Este método reduce
`comprometido` y no valida ni modifica `cantidad`, por lo que también funciona
si el ERP permite existencia física negativa.

La cancelación usa `revertirReservaTransferenciaLote`, que realiza en una
transacción la operación inversa a la creación: suma a `cantidad` y resta de
`comprometido` en el depósito donde se hizo la reserva.

## Pedidos anteriores al cambio

Una transferencia histórica puede haber quedado en `ERROR_STOCK` porque la API
intentó descontar nuevamente la existencia al aprobar. Estos pedidos se pueden
reintentar si tienen un cobro válido: la aprobación reducirá únicamente su
stock comprometido y los marcará como `APROBADO`.

Para que la reversión sea exacta, cada producto debe conservar
`deposito_reserva`. Los pedidos nuevos lo guardan al momento de reservar. En
pedidos históricos sin ese dato se elige una existencia del artículo que tenga
compromiso suficiente.
