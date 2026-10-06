# Clerk y autorizacion mayorista

Las rutas protegidas aceptan exclusivamente un token de sesion Clerk:

```http
Authorization: Bearer <token>
```

Ejemplo para el frontend Vite/React:

```ts
const { getToken } = useAuth();
const token = await getToken();

const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

`GET /auth/me` crea de forma idempotente `ecommerce_usuario` la primera vez,
siempre con `NO_SOLICITADO`. No crea un cliente ERP. `GET /mayorista/status`
requiere que el registro tenga `estado_mayorista = 'APROBADO'`.

El usuario puede solicitar acceso mayorista desde `NO_SOLICITADO` o volver a
solicitarlo desde `RECHAZADO`:

```http
POST /mayorista/solicitud
Authorization: Bearer <token Clerk>
Content-Type: application/json

{
  "nombreComercio": "Impresiones Cuyo",
  "personaResponsable": "Ana Perez",
  "ubicacionZona": "Godoy Cruz, Mendoza",
  "telefono": "2615551234",
  "figuraFiscalComercial": "EMPRENDEDOR_MONOTRIBUTISTA",
  "perfilCompraInicial": "GRAN_CONSUMIDOR_FINAL_96_239_KG",
  "sedeComercial": "TALLER_OFICINA",
  "ofertasPublico": ["SERVICIO_IMPRESION_3D", "VENTA_ACTUAL_FILAMENTOS"],
  "marcasFilamento": "WeTech, Grilon3"
}
```

`ofertasPublico` permite seleccionar una o varias actividades. Si incluye
`VENTA_ACTUAL_FILAMENTOS`, `marcasFilamento` es obligatorio.

La solicitud guarda los datos localmente y cambia el estado a `PENDIENTE`. No
crea un cliente ERP.

El estado se administra con el token interno de escritura del backend:

```http
PATCH /admin/ecommerce-usuarios/123/estado
Authorization: Bearer <WRITE_API_TOKEN>
Content-Type: application/json

{"estado":"APROBADO"}
```

El panel administrativo puede obtener usuarios con el token de lectura:

```http
GET /admin/ecommerce-usuarios?page=1&limit=20&estado=PENDIENTE
Authorization: Bearer <READ_API_TOKEN>

GET /admin/ecommerce-usuarios/123
Authorization: Bearer <READ_API_TOKEN>
```

Variables requeridas en el backend:

```env
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
FRONTEND_URL=http://localhost:5173
```

`FRONTEND_URL` puede contener varios origenes separados por coma. Los origenes
adicionales de `ALLOWED_ORIGINS` tambien se usan para CORS y para validar el
`azp` del token Clerk.

Antes del despliegue, ejecutar el SQL
las migraciones de `ecommerce_usuario`, incluida
`migrations/20261005_expand_solicitud_mayorista.sql`, sobre la base configurada
por `BACK_DB_NAME`. La aplicacion mantiene `synchronize: false`.

El estado mayorista se aprueba mediante un proceso administrativo que actualice
la base de datos; nunca se acepta desde React ni desde metadata de Clerk. Los
precios y descuentos finales deben seguir calculandose en el backend.
