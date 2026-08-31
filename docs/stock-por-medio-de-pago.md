# Modelo de reserva de stock

## Invariantes

La API usa la misma regla para pagos online y transferencias:

- `cantidad` es el stock que el ERP y las ventas presenciales pueden vender.
- `comprometido` es stock retirado de la venta y reservado para pedidos.
- Mientras un pedido esta pendiente, el stock fisico bajo custodia es
  `cantidad + comprometido`.
- Un comprobante `FX` no modifica por si solo `stk_existencia`.

Los movimientos validos son:

| Evento                         |  `cantidad` | `comprometido` |
| ------------------------------ | ----------: | -------------: |
| Reservar                       |        `-N` |           `+N` |
| Aprobar                        | Sin cambios |           `-N` |
| Cancelar, rechazar o expirar   |        `+N` |           `-N` |
| Restaurar una reserva huerfana |        `+N` |           `-N` |

La disponibilidad publicada por catalogo y lista de espera es la suma de
`cantidad` de todos los depositos. No se vuelve a restar `comprometido`, porque
la existencia ya bajo al crear la reserva.

## Ciclos de ejemplo

Con `cantidad = 2` y `comprometido = 0`, reservar dos unidades deja
`cantidad = 0` y `comprometido = 2`. El ERP ve cero unidades vendibles.

- Si el pedido se aprueba, queda `cantidad = 0`, `comprometido = 0`.
- Si se cancela, rechaza o expira, vuelve a `cantidad = 2`,
  `comprometido = 0`.

Online y transferencia ejecutan exactamente los mismos movimientos. Los items
virtuales cuyo codigo comienza con `ENV` no modifican stock y usan el deposito
virtual `ENV`.

## Atomicidad y compensaciones

Las reservas, confirmaciones y liberaciones se procesan por lote dentro de una
transaccion con bloqueo pesimista. Primero se valida el pedido completo y solo
despues se guardan los cambios; una linea invalida revierte todo el lote.

Si falla el guardado del pedido o la generacion del pago despues de reservar,
se libera el lote: se repone `cantidad` y se reduce `comprometido`. Si una
operacion critica falla despues de confirmar, se restaura unicamente
`comprometido`, porque `cantidad` ya se habia descontado al reservar.

`POST /stk-existencia/comprometidos/sin-pedido/restaurar` repone `cantidad` y
reduce `comprometido` solo por el excedente que no corresponde a pedidos
`PENDIENTE` o `ERROR_STOCK`.

La restauracion debe ejecutarse sin creaciones, aprobaciones o cancelaciones de
pedidos en paralelo, porque el stock del ERP y los pedidos viven en conexiones
de base de datos diferentes y no comparten una transaccion distribuida.

## Transicion desde el modelo anterior

El modelo nuevo solo debe desplegarse cuando no queden compromisos creados con
la logica anterior:

1. Resolver o cancelar todos los pedidos `PENDIENTE` y `ERROR_STOCK`.
2. Auditar compromisos sin pedido con `GET /stk-existencia/comprometidos`.
3. Limpiar los huerfanos antiguos reduciendo solo `comprometido`, sin aumentar
   `cantidad`; el endpoint de restauracion nuevo no debe usarse para esa tarea.
4. Verificar que todas las filas tengan `comprometido = 0`.
5. Desplegar la nueva version y ejecutar una reserva de control.

Si la existencia disponible es menor que una reserva que debe migrarse, el
proceso se bloquea y el faltante se corrige manualmente. No se permiten valores
negativos ni ajustes silenciosos.

No se debe volver a una version con la logica anterior mientras existan
reservas nuevas. Antes de un rollback hay que cancelar/liberar esas reservas o
convertir los datos explicitamente.
