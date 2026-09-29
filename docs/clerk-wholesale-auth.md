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
`migrations/20260928_create_ecommerce_usuario.sql` sobre la base configurada
por `BACK_DB_NAME`. La aplicacion mantiene `synchronize: false`.

El estado mayorista se aprueba mediante un proceso administrativo que actualice
la base de datos; nunca se acepta desde React ni desde metadata de Clerk. Los
precios y descuentos finales deben seguir calculandose en el backend.
