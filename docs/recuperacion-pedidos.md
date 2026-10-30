# Recuperacion de pedidos y motivos de cancelacion

## Contrato para el frontend

Las operaciones requieren el token con permiso `write` que ya usan las otras
acciones administrativas de pedidos.

`POST /pedido/:externalId/recuperar`

```json
{ "estado": "PENDIENTE" }
```

Tambien admite `APROBADO`. Responde HTTP 200 con `{ message, pedido }`.
Solo admite pedidos `CANCELADO` o `CANCELADO_MANUAL`: devolver otro estado, repetir
una recuperacion exitosa o intentar recuperaciones simultaneas del mismo pedido
produce HTTP 409 en la solicitud que ya no encuentra el pedido cancelado.
Un destino invalido produce HTTP 400; un pedido inexistente, HTTP 404.

- `PENDIENTE` reserva stock y asegura el comprobante pendiente para transferencias.
  El vencimiento comienza nuevamente en `recuperado`, manteniendo horarios y TTL
  actuales. `creado` conserva su valor original.
- `APROBADO` confirma stock y asegura el comprobante. La decision administrativa
  alcanza: no se verifica ni se registra un pago. Los comprobantes nuevos quedan
  sin cobrar y su asiento refleja deuda; los existentes conservan sus cobros.
- Si la reserva ya esta confirmada, solo se permite `APROBADO`.
- Falta de stock, una reserva incompatible o una cancelacion manual sin
  trazabilidad suficiente producen HTTP 409 y requieren corregir la causa.
- Se mantienen productos, precios, metodo de pago y la ultima causa de cancelacion.
  Las notificaciones de aprobacion y el registro del cupon se ejecutan una vez
  por recuperacion exitosa a `APROBADO`.

Los endpoints existentes `/cancelar`, `/cancelar-manual` y `/rechazar` aceptan
un cuerpo opcional:

```json
{ "motivo": "Solicitud del cliente" }
```

El texto se recorta y admite hasta 255 caracteres. Un texto vacio o un motivo
omitido usa la causa predeterminada. Tipos invalidos o textos mas largos producen
HTTP 400. Las llamadas sin cuerpo siguen funcionando. La cancelacion manual
repetida conserva su respuesta idempotente y no cambia el motivo anterior.

Detalle, listado y respuestas de acciones incluyen `motivo_cancelacion` y
`recuperado`. Son `null` en pedidos historicos sin esos datos. El motivo conserva
la ultima cancelacion incluso tras recuperar; una nueva cancelacion lo reemplaza.
Las cancelaciones automaticas tambien guardan su causa.

## Migracion y verificacion

Antes de desplegar, ejecutar en `BACK_DB_NAME`:

```sql
SOURCE migrations/20261028_add_recuperacion_y_motivo_cancelacion_to_pedido.sql;
```

Requiere las migraciones de reservas persistentes del 2026-10-27 en BACK y ERP.
Para instalaciones que aun usan compromisos antiguos, seguir primero la transicion
de `docs/stock-por-medio-de-pago.md`; no convertir ni liberar stock automaticamente.

Verificar un pedido recuperado a cada destino, el nuevo plazo de vencimiento,
reservas/comprobantes sin duplicados y ausencia de cobros nuevos. La reconciliacion
usa la ultima actualizacion de la reserva para dar margen a una reactivacion.

Pedidos, stock y comprobantes usan conexiones distintas. Los errores compensan
las confirmaciones del intento y liberan solo sus reservas nuevas o reactivadas.
Los comprobantes completos se conservan para reutilizarlos en un reintento.
Si falla la compensacion o el proceso se interrumpe entre conexiones, revisar la
trazabilidad y ejecutar la reconciliacion existente antes de reintentar. No hay
atomicidad distribuida ni garantia de entrega de notificaciones ante una caida.
