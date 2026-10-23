# Complementos: descuentos por transferencia

El servidor calcula los descuentos de `COMPLEMENTOS PARA IMPRESION 3D` al crear
el pedido. En pagos `online` no se aplican estas promociones automaticas.

Todos los complementos tienen 15% base. Desde 10 unidades de la misma presentacion,
incluyendo colores y lineas repetidas, el porcentaje **reemplaza** al 15%:

| Presentacion                  | Descuento |
| ----------------------------- | --------: |
| Vaso aluminio 500 ml          |    21,29% |
| Vaso aluminio 600 ml          |    22,72% |
| Vaso aluminio 1 litro         |    19,60% |
| Inserto mate (blanco + negro) |    27,20% |
| Inserto taza                  |    25,64% |
| Inserto Milkshake             |    32,01% |

Las capacidades de vaso se cuentan por separado. Los demas complementos conservan
15%, incluso desde 10 unidades. El mapeo de SKU/padres esta en `src/pricing/discounts.ts`.

## Combo automatico

Un par de `INS-MATE-BLAN` o `INS-MATE-NEGR` + `INS-BOMB-NEGR` tiene 25% para
1 a 9 pares y 35% desde 10 pares. Se comparan los importes con la compra individual,
incluyendo el cupon aplicable, y se conserva el menor total. En empate no se activa
el combo. Los porcentajes no se acumulan. Milkshake no forma este combo.

Los sobrantes usan su descuento individual, contando todas las unidades compradas
para alcanzar el umbral de la presentacion. El combo descuenta ambos componentes;
no existe un SKU de combo ni stock independiente.

## Contrato y despliegue

`POST /pedido` mantiene su entrada: SKU normales en `productos[].nombre` y cantidades.
Precios e importes son opcionales; si se envian, se validan contra el calculo del
servidor. Los importes de una linea original se validan agregando sus partes de
combo y sobrantes. Se mantienen las convenciones de factura, IVA y redondeo existentes.

Las respuestas y los comprobantes pueden contener varias lineas con el mismo SKU,
con cantidades y porcentajes diferentes. Los consumidores deben conservarlas;
el stock se reserva y restituye por las cantidades reales de cada componente.

El catalogo publica `promotionalPrice` y SEO publica `precioPromocional` con el
15% base por transferencia. Los tramos y combos dependen del carrito.

Actualizar el calculo del frontend junto con la API: un carrito que envie importes
calculados con las reglas anteriores puede recibir `ERR_ORDER_TOTAL_MISMATCH`.
No se requieren migraciones ni nuevas dependencias. Los pedidos ya guardados no se recalculan.
