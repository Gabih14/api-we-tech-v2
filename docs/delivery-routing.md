# Cotizacion de delivery

La cotizacion se obtiene con:

```http
GET /stk-item/costo/35?provincia=Mendoza&departamento=Capital
```

El backend consulta en una sola operacion todos los items con formato
`ENV-<n>K-GM-DELIVERY` y elige el menor kilometraje que cubra la distancia. Si
ninguno alcanza, consulta los registros activos de `delivery_config` cuyo
`kms` cubra la distancia.

La prioridad geografica es:

1. Provincia y departamento.
2. Solo departamento.
3. Solo provincia.
4. Sin provincia ni departamento (configuracion global).

Entre configuraciones con igual prioridad se elige primero el menor `kms` que
cubra la distancia y luego el menor `id`.

## Validacion del pedido

Los pedidos `shipping` nuevos deben incluir `distancia_envio` para que el
backend vuelva a resolver y validar el item cotizado. Tambien pueden enviar
`provincia_envio` y `departamento_envio`; cuando se omiten se usan `region` y
`city` de `billing_address`.

Durante la transicion, los pedidos antiguos que no incluyen
`distancia_envio` conservan el comportamiento anterior.

## Cambio de esquema

Antes de desplegar esta version se debe ejecutar una vez:

```text
sql/20260825_delivery_routing.sql
```

El script agrega el estado `activo` de las configuraciones y los campos del
pedido que registran la distancia, la zona y el `delivery_config` utilizado.

## Notificaciones

Los pedidos cotizados con productos `ENV-<n>K-GM-DELIVERY` se notifican al
chat configurado en `DELIVERY_TELEGRAM_CHAT_ID`. Cuando el pedido tiene un
`delivery_config_id`, se notifica al chat configurado en
`DELIVERY_GENERAL_TELEGRAM_CHAT_ID`.

Los campos `telefono` y `api_key` de `delivery_config` son opcionales y pueden
quedar en `NULL`. Para actualizar una base que conserva ambas columnas como
obligatorias, ejecutar una vez
`sql/20260825_delivery_config_optional_credentials.sql`.
