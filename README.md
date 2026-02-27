

# 📦 API WeTech V2

API desarrollada con **NestJS**, orientada a la gestión de stock, pedidos y operaciones de venta para una plataforma de e-commerce.  
Integra servicios de pago externos (como **Nave**) y módulos de catálogo, stock, comprobantes y más.

---

## 🚀 Instalación

# Clona el repositorio
```bash
git clone https://github.com/tu-usuario/api-we-tech-v2.git
cd api-we-tech-v2
```

# Instala las dependencias
```bash
npm install
```

---

## 🛠️ Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes claves mínimas:

```env
GOOGLE_API_KEY=tu_google_api_key
```

⚠️ Otros tokens, como el de Nave, están embebidos por ahora.
**Se recomienda externalizarlos a `.env` por seguridad.**

---

## 🧱 Estructura del proyecto

El proyecto sigue la arquitectura modular de **NestJS**:

```
api-we-tech-v2/
├─ src/
│  ├─ pedido/                # Lógica principal de pedidos y pagos
│  ├─ stk-item/              # Catálogo de productos
│  ├─ stk-existencia/        # Gestión de stock y depósitos
│  ├─ vta-comprobante/       # Comprobantes de venta
│  ├─ maps/                  # Integración con APIs de mapas
│  └─ ...                    # Otros módulos: moneda, imágenes, familias
├─ test/                     # Pruebas end-to-end (e2e)
├─ docker-compose.yml        # Configuración opcional de servicios externos
├─ .prettierrc, eslint.config.mjs, etc.
```

---

## 🧪 Comandos útiles

```bash
# Iniciar servidor en desarrollo
npm run start:dev

# Ejecutar pruebas unitarias
npm run test

# Compilar para producción
npm run build
```

---

## 🧾 Endpoints destacados

### 🛒 POST `/pedido`

Crea un pedido y genera automáticamente la intención de pago con Nave.
No es necesario enviar `external_id`; se genera internamente.

#### ✅ Body de ejemplo

```json
{
  "cliente_nombre": "Juan Pérez",
  "cliente_cuit": "20304567890",
  "total": 3000,
  "email": "juan.perez@example.com",
  "telefono": "2611234567",
  "calle": "Av. Las Heras 123",
  "ciudad": "Mendoza",
  "region": "Mendoza",
  "pais": "Argentina",
  "codigo_postal": "5500",
  "mobile": "true",
  "productos": [
    {
      "nombre": "123",
      "cantidad": 2,
      "precio_unitario": 1000
    },
    {
      "nombre": "456",
      "cantidad": 1,
      "precio_unitario": 1000
    }
  ]
}
```

#### 🔁 Respuesta

```json
{
  "pedido": {
    "id": 1,
    "cliente_nombre": "Juan Pérez",
    ...
  },
  "naveUrl": "https://ecommerce.ranty.io/payment/abc123..."
}
```

---

## 🔐 Seguridad y validaciones

* Validaciones robustas con `class-validator` en todos los DTOs.
* Manejo centralizado de errores (`BadRequest`, `NotFound`, `InternalServerError`).
* Sanitización de IDs para integraciones externas (solo caracteres alfanuméricos).

---

## 📦 Buenas prácticas implementadas

* Modularización clara por feature (`stk-item`, `pedido`, `vta-comprobante`, etc.).
* Uso de DTOs para validación y tipado estricto.
* Inyección de dependencias con `forwardRef` en módulos con ciclos.
* Relaciones bien definidas entre entidades (`@OneToMany`, `@ManyToOne`).
* Externalización de credenciales mediante `.env`.
* Manejo robusto de tokens externos (como Nave), con reintentos automáticos.
* Generación segura de `external_id` con `uuid`.

---

## 🧪 Testing con Postman

1. Iniciá el servidor con `npm run start:dev`.
2. Probá el endpoint `POST /pedido` usando el body de ejemplo.
3. Verificá la respuesta y la URL de pago generada por Nave.
4. Consultá el pedido con `GET /pedido/:external_id`.

---

## 📬 Contacto y soporte

¿Dudas o sugerencias?
Abrí un issue en GitHub o contactá al equipo de desarrollo.

---


```

```
api-we-tech-v2
├─ .prettierrc
├─ Dockerfile
├─ README.md
├─ dist
│  ├─ scripts
│  │  ├─ test-notify.d.ts
│  │  ├─ test-notify.js
│  │  └─ test-notify.js.map
│  ├─ src
│  │  ├─ app.controller.d.ts
│  │  ├─ app.controller.js
│  │  ├─ app.controller.js.map
│  │  ├─ app.module.d.ts
│  │  ├─ app.module.js
│  │  ├─ app.module.js.map
│  │  ├─ app.service.d.ts
│  │  ├─ app.service.js
│  │  ├─ app.service.js.map
│  │  ├─ bas-moneda
│  │  │  ├─ bas-moneda.controller.d.ts
│  │  │  ├─ bas-moneda.controller.js
│  │  │  ├─ bas-moneda.controller.js.map
│  │  │  ├─ bas-moneda.module.d.ts
│  │  │  ├─ bas-moneda.module.js
│  │  │  ├─ bas-moneda.module.js.map
│  │  │  ├─ bas-moneda.service.d.ts
│  │  │  ├─ bas-moneda.service.js
│  │  │  ├─ bas-moneda.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ create-bas-moneda.dto.d.ts
│  │  │  │  ├─ create-bas-moneda.dto.js
│  │  │  │  ├─ create-bas-moneda.dto.js.map
│  │  │  │  ├─ update-bas-moneda.dto.d.ts
│  │  │  │  ├─ update-bas-moneda.dto.js
│  │  │  │  └─ update-bas-moneda.dto.js.map
│  │  │  └─ entities
│  │  │     ├─ bas-moneda.entity.d.ts
│  │  │     ├─ bas-moneda.entity.js
│  │  │     └─ bas-moneda.entity.js.map
│  │  ├─ cnt-asiento
│  │  │  ├─ cnt-asiento.controller.d.ts
│  │  │  ├─ cnt-asiento.controller.js
│  │  │  ├─ cnt-asiento.controller.js.map
│  │  │  ├─ cnt-asiento.module.d.ts
│  │  │  ├─ cnt-asiento.module.js
│  │  │  ├─ cnt-asiento.module.js.map
│  │  │  ├─ cnt-asiento.service.d.ts
│  │  │  ├─ cnt-asiento.service.js
│  │  │  ├─ cnt-asiento.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ create-cnt-asiento.dto.d.ts
│  │  │  │  ├─ create-cnt-asiento.dto.js
│  │  │  │  ├─ create-cnt-asiento.dto.js.map
│  │  │  │  ├─ update-cnt-asiento.dto.d.ts
│  │  │  │  ├─ update-cnt-asiento.dto.js
│  │  │  │  └─ update-cnt-asiento.dto.js.map
│  │  │  └─ entities
│  │  │     ├─ cnt-asiento.entity.d.ts
│  │  │     ├─ cnt-asiento.entity.js
│  │  │     └─ cnt-asiento.entity.js.map
│  │  ├─ cnt-movimiento
│  │  │  ├─ cnt-movimiento.controller.d.ts
│  │  │  ├─ cnt-movimiento.controller.js
│  │  │  ├─ cnt-movimiento.controller.js.map
│  │  │  ├─ cnt-movimiento.module.d.ts
│  │  │  ├─ cnt-movimiento.module.js
│  │  │  ├─ cnt-movimiento.module.js.map
│  │  │  ├─ cnt-movimiento.service.d.ts
│  │  │  ├─ cnt-movimiento.service.js
│  │  │  ├─ cnt-movimiento.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ create-cnt-movimiento.dto.d.ts
│  │  │  │  ├─ create-cnt-movimiento.dto.js
│  │  │  │  ├─ create-cnt-movimiento.dto.js.map
│  │  │  │  ├─ update-cnt-movimiento.dto.d.ts
│  │  │  │  ├─ update-cnt-movimiento.dto.js
│  │  │  │  └─ update-cnt-movimiento.dto.js.map
│  │  │  └─ entities
│  │  │     ├─ cnt-movimiento.entity.d.ts
│  │  │     ├─ cnt-movimiento.entity.js
│  │  │     └─ cnt-movimiento.entity.js.map
│  │  ├─ common
│  │  │  ├─ decorators
│  │  │  │  ├─ auth-type.decorator.d.ts
│  │  │  │  ├─ auth-type.decorator.js
│  │  │  │  └─ auth-type.decorator.js.map
│  │  │  ├─ filters
│  │  │  │  ├─ http-exception.filter.d.ts
│  │  │  │  ├─ http-exception.filter.js
│  │  │  │  └─ http-exception.filter.js.map
│  │  │  ├─ guards
│  │  │  │  ├─ api-token.guard.d.ts
│  │  │  │  ├─ api-token.guard.js
│  │  │  │  └─ api-token.guard.js.map
│  │  │  ├─ interceptors
│  │  │  │  ├─ logging.interceptor.d.ts
│  │  │  │  ├─ logging.interceptor.js
│  │  │  │  └─ logging.interceptor.js.map
│  │  │  └─ transformers
│  │  │     ├─ bit-to-bool.transformer.d.ts
│  │  │     ├─ bit-to-bool.transformer.js
│  │  │     └─ bit-to-bool.transformer.js.map
│  │  ├─ cupon
│  │  │  ├─ cupon.controller.d.ts
│  │  │  ├─ cupon.controller.js
│  │  │  ├─ cupon.controller.js.map
│  │  │  ├─ cupon.module.d.ts
│  │  │  ├─ cupon.module.js
│  │  │  ├─ cupon.module.js.map
│  │  │  ├─ cupon.service.d.ts
│  │  │  ├─ cupon.service.js
│  │  │  ├─ cupon.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ create-cupon.dto.d.ts
│  │  │  │  ├─ create-cupon.dto.js
│  │  │  │  ├─ create-cupon.dto.js.map
│  │  │  │  ├─ update-cupon.dto.d.ts
│  │  │  │  ├─ update-cupon.dto.js
│  │  │  │  └─ update-cupon.dto.js.map
│  │  │  └─ entities
│  │  │     ├─ cupon.entity.d.ts
│  │  │     ├─ cupon.entity.js
│  │  │     └─ cupon.entity.js.map
│  │  ├─ cupon_uso
│  │  │  ├─ cupon_uso.controller.d.ts
│  │  │  ├─ cupon_uso.controller.js
│  │  │  ├─ cupon_uso.controller.js.map
│  │  │  ├─ cupon_uso.module.d.ts
│  │  │  ├─ cupon_uso.module.js
│  │  │  ├─ cupon_uso.module.js.map
│  │  │  ├─ cupon_uso.service.d.ts
│  │  │  ├─ cupon_uso.service.js
│  │  │  ├─ cupon_uso.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ create-cupon_uso.dto.d.ts
│  │  │  │  ├─ create-cupon_uso.dto.js
│  │  │  │  ├─ create-cupon_uso.dto.js.map
│  │  │  │  ├─ update-cupon_uso.dto.d.ts
│  │  │  │  ├─ update-cupon_uso.dto.js
│  │  │  │  └─ update-cupon_uso.dto.js.map
│  │  │  └─ entities
│  │  │     ├─ cupon_uso.entity.d.ts
│  │  │     ├─ cupon_uso.entity.js
│  │  │     └─ cupon_uso.entity.js.map
│  │  ├─ mailer
│  │  │  ├─ mailer.module.d.ts
│  │  │  ├─ mailer.module.js
│  │  │  ├─ mailer.module.js.map
│  │  │  ├─ mailer.service.d.ts
│  │  │  ├─ mailer.service.js
│  │  │  └─ mailer.service.js.map
│  │  ├─ main.d.ts
│  │  ├─ main.js
│  │  ├─ main.js.map
│  │  ├─ maps
│  │  │  ├─ dto
│  │  │  │  ├─ get-distance.dto.d.ts
│  │  │  │  ├─ get-distance.dto.js
│  │  │  │  └─ get-distance.dto.js.map
│  │  │  ├─ maps.controller.d.ts
│  │  │  ├─ maps.controller.js
│  │  │  ├─ maps.controller.js.map
│  │  │  ├─ maps.module.d.ts
│  │  │  ├─ maps.module.js
│  │  │  ├─ maps.module.js.map
│  │  │  ├─ maps.service.d.ts
│  │  │  ├─ maps.service.js
│  │  │  └─ maps.service.js.map
│  │  ├─ pedido
│  │  │  ├─ dto
│  │  │  │  ├─ create-pedido.dto.d.ts
│  │  │  │  ├─ create-pedido.dto.js
│  │  │  │  ├─ create-pedido.dto.js.map
│  │  │  │  ├─ update-pedido.dto.d.ts
│  │  │  │  ├─ update-pedido.dto.js
│  │  │  │  └─ update-pedido.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ pedido-item.entity.d.ts
│  │  │  │  ├─ pedido-item.entity.js
│  │  │  │  ├─ pedido-item.entity.js.map
│  │  │  │  ├─ pedido.entity.d.ts
│  │  │  │  ├─ pedido.entity.js
│  │  │  │  └─ pedido.entity.js.map
│  │  │  ├─ pedido-expiration.service.d.ts
│  │  │  ├─ pedido-expiration.service.js
│  │  │  ├─ pedido-expiration.service.js.map
│  │  │  ├─ pedido.controller.d.ts
│  │  │  ├─ pedido.controller.js
│  │  │  ├─ pedido.controller.js.map
│  │  │  ├─ pedido.module.d.ts
│  │  │  ├─ pedido.module.js
│  │  │  ├─ pedido.module.js.map
│  │  │  ├─ pedido.service.d.ts
│  │  │  ├─ pedido.service.js
│  │  │  └─ pedido.service.js.map
│  │  ├─ stk-deposito
│  │  │  ├─ dto
│  │  │  │  ├─ create-stk-deposito.dto.d.ts
│  │  │  │  ├─ create-stk-deposito.dto.js
│  │  │  │  ├─ create-stk-deposito.dto.js.map
│  │  │  │  ├─ update-stk-deposito.dto.d.ts
│  │  │  │  ├─ update-stk-deposito.dto.js
│  │  │  │  └─ update-stk-deposito.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ stk-deposito.entity.d.ts
│  │  │  │  ├─ stk-deposito.entity.js
│  │  │  │  └─ stk-deposito.entity.js.map
│  │  │  ├─ stk-deposito.controller.d.ts
│  │  │  ├─ stk-deposito.controller.js
│  │  │  ├─ stk-deposito.controller.js.map
│  │  │  ├─ stk-deposito.module.d.ts
│  │  │  ├─ stk-deposito.module.js
│  │  │  ├─ stk-deposito.module.js.map
│  │  │  ├─ stk-deposito.service.d.ts
│  │  │  ├─ stk-deposito.service.js
│  │  │  └─ stk-deposito.service.js.map
│  │  ├─ stk-existencia
│  │  │  ├─ dto
│  │  │  │  ├─ create-stk-existencia.dto.d.ts
│  │  │  │  ├─ create-stk-existencia.dto.js
│  │  │  │  ├─ create-stk-existencia.dto.js.map
│  │  │  │  ├─ update-stk-existencia.dto.d.ts
│  │  │  │  ├─ update-stk-existencia.dto.js
│  │  │  │  └─ update-stk-existencia.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ stk-existencia.entity.d.ts
│  │  │  │  ├─ stk-existencia.entity.js
│  │  │  │  └─ stk-existencia.entity.js.map
│  │  │  ├─ stk-existencia.controller.d.ts
│  │  │  ├─ stk-existencia.controller.js
│  │  │  ├─ stk-existencia.controller.js.map
│  │  │  ├─ stk-existencia.module.d.ts
│  │  │  ├─ stk-existencia.module.js
│  │  │  ├─ stk-existencia.module.js.map
│  │  │  ├─ stk-existencia.service.d.ts
│  │  │  ├─ stk-existencia.service.js
│  │  │  └─ stk-existencia.service.js.map
│  │  ├─ stk-item
│  │  │  ├─ dto
│  │  │  │  ├─ create-stk-item.dto.d.ts
│  │  │  │  ├─ create-stk-item.dto.js
│  │  │  │  ├─ create-stk-item.dto.js.map
│  │  │  │  ├─ update-stk-item.dto.d.ts
│  │  │  │  ├─ update-stk-item.dto.js
│  │  │  │  └─ update-stk-item.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ stk-item.entity.d.ts
│  │  │  │  ├─ stk-item.entity.js
│  │  │  │  └─ stk-item.entity.js.map
│  │  │  ├─ stk-item.controller.d.ts
│  │  │  ├─ stk-item.controller.js
│  │  │  ├─ stk-item.controller.js.map
│  │  │  ├─ stk-item.module.d.ts
│  │  │  ├─ stk-item.module.js
│  │  │  ├─ stk-item.module.js.map
│  │  │  ├─ stk-item.service.d.ts
│  │  │  ├─ stk-item.service.js
│  │  │  └─ stk-item.service.js.map
│  │  ├─ stk-precio
│  │  │  ├─ dto
│  │  │  │  ├─ create-stk-precio.dto.d.ts
│  │  │  │  ├─ create-stk-precio.dto.js
│  │  │  │  ├─ create-stk-precio.dto.js.map
│  │  │  │  ├─ update-stk-precio.dto.d.ts
│  │  │  │  ├─ update-stk-precio.dto.js
│  │  │  │  └─ update-stk-precio.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ stk-precio.entity.d.ts
│  │  │  │  ├─ stk-precio.entity.js
│  │  │  │  └─ stk-precio.entity.js.map
│  │  │  ├─ stk-precio.controller.d.ts
│  │  │  ├─ stk-precio.controller.js
│  │  │  ├─ stk-precio.controller.js.map
│  │  │  ├─ stk-precio.module.d.ts
│  │  │  ├─ stk-precio.module.js
│  │  │  ├─ stk-precio.module.js.map
│  │  │  ├─ stk-precio.service.d.ts
│  │  │  ├─ stk-precio.service.js
│  │  │  └─ stk-precio.service.js.map
│  │  ├─ stk_familia
│  │  │  ├─ dto
│  │  │  │  ├─ create-stk_familia.dto.d.ts
│  │  │  │  ├─ create-stk_familia.dto.js
│  │  │  │  ├─ create-stk_familia.dto.js.map
│  │  │  │  ├─ update-stk_familia.dto.d.ts
│  │  │  │  ├─ update-stk_familia.dto.js
│  │  │  │  └─ update-stk_familia.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ stk_familia.entity.d.ts
│  │  │  │  ├─ stk_familia.entity.js
│  │  │  │  └─ stk_familia.entity.js.map
│  │  │  ├─ stk_familia.controller.d.ts
│  │  │  ├─ stk_familia.controller.js
│  │  │  ├─ stk_familia.controller.js.map
│  │  │  ├─ stk_familia.module.d.ts
│  │  │  ├─ stk_familia.module.js
│  │  │  ├─ stk_familia.module.js.map
│  │  │  ├─ stk_familia.service.d.ts
│  │  │  ├─ stk_familia.service.js
│  │  │  └─ stk_familia.service.js.map
│  │  ├─ sys_image
│  │  │  ├─ dto
│  │  │  │  ├─ create-sys_image.dto.d.ts
│  │  │  │  ├─ create-sys_image.dto.js
│  │  │  │  ├─ create-sys_image.dto.js.map
│  │  │  │  ├─ update-sys_image.dto.d.ts
│  │  │  │  ├─ update-sys_image.dto.js
│  │  │  │  └─ update-sys_image.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ sys_image.entity.d.ts
│  │  │  │  ├─ sys_image.entity.js
│  │  │  │  └─ sys_image.entity.js.map
│  │  │  ├─ sys_image.controller.d.ts
│  │  │  ├─ sys_image.controller.js
│  │  │  ├─ sys_image.controller.js.map
│  │  │  ├─ sys_image.module.d.ts
│  │  │  ├─ sys_image.module.js
│  │  │  ├─ sys_image.module.js.map
│  │  │  ├─ sys_image.service.d.ts
│  │  │  ├─ sys_image.service.js
│  │  │  └─ sys_image.service.js.map
│  │  ├─ vta-cobro
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta-cobro.dto.d.ts
│  │  │  │  ├─ create-vta-cobro.dto.js
│  │  │  │  ├─ create-vta-cobro.dto.js.map
│  │  │  │  ├─ update-vta-cobro.dto.d.ts
│  │  │  │  ├─ update-vta-cobro.dto.js
│  │  │  │  └─ update-vta-cobro.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta-cobro.entity.d.ts
│  │  │  │  ├─ vta-cobro.entity.js
│  │  │  │  └─ vta-cobro.entity.js.map
│  │  │  ├─ vta-cobro.controller.d.ts
│  │  │  ├─ vta-cobro.controller.js
│  │  │  ├─ vta-cobro.controller.js.map
│  │  │  ├─ vta-cobro.module.d.ts
│  │  │  ├─ vta-cobro.module.js
│  │  │  ├─ vta-cobro.module.js.map
│  │  │  ├─ vta-cobro.service.d.ts
│  │  │  ├─ vta-cobro.service.js
│  │  │  └─ vta-cobro.service.js.map
│  │  ├─ vta-cobro-factura
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta-cobro-factura.dto.d.ts
│  │  │  │  ├─ create-vta-cobro-factura.dto.js
│  │  │  │  ├─ create-vta-cobro-factura.dto.js.map
│  │  │  │  ├─ update-vta-cobro-factura.dto.d.ts
│  │  │  │  ├─ update-vta-cobro-factura.dto.js
│  │  │  │  └─ update-vta-cobro-factura.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta-cobro-factura.entity.d.ts
│  │  │  │  ├─ vta-cobro-factura.entity.js
│  │  │  │  └─ vta-cobro-factura.entity.js.map
│  │  │  ├─ vta-cobro-factura.controller.d.ts
│  │  │  ├─ vta-cobro-factura.controller.js
│  │  │  ├─ vta-cobro-factura.controller.js.map
│  │  │  ├─ vta-cobro-factura.module.d.ts
│  │  │  ├─ vta-cobro-factura.module.js
│  │  │  ├─ vta-cobro-factura.module.js.map
│  │  │  ├─ vta-cobro-factura.service.d.ts
│  │  │  ├─ vta-cobro-factura.service.js
│  │  │  └─ vta-cobro-factura.service.js.map
│  │  ├─ vta-cobro-medio
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta-cobro-medio.dto.d.ts
│  │  │  │  ├─ create-vta-cobro-medio.dto.js
│  │  │  │  ├─ create-vta-cobro-medio.dto.js.map
│  │  │  │  ├─ update-vta-cobro-medio.dto.d.ts
│  │  │  │  ├─ update-vta-cobro-medio.dto.js
│  │  │  │  └─ update-vta-cobro-medio.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta-cobro-medio.entity.d.ts
│  │  │  │  ├─ vta-cobro-medio.entity.js
│  │  │  │  └─ vta-cobro-medio.entity.js.map
│  │  │  ├─ vta-cobro-medio.controller.d.ts
│  │  │  ├─ vta-cobro-medio.controller.js
│  │  │  ├─ vta-cobro-medio.controller.js.map
│  │  │  ├─ vta-cobro-medio.module.d.ts
│  │  │  ├─ vta-cobro-medio.module.js
│  │  │  ├─ vta-cobro-medio.module.js.map
│  │  │  ├─ vta-cobro-medio.service.d.ts
│  │  │  ├─ vta-cobro-medio.service.js
│  │  │  └─ vta-cobro-medio.service.js.map
│  │  ├─ vta-comprobante
│  │  │  ├─ cobros.service.d.ts
│  │  │  ├─ cobros.service.js
│  │  │  ├─ cobros.service.js.map
│  │  │  ├─ dto
│  │  │  │  ├─ cobrar-factura.dto.d.ts
│  │  │  │  ├─ cobrar-factura.dto.js
│  │  │  │  ├─ cobrar-factura.dto.js.map
│  │  │  │  ├─ create-vta-comprobante.dto.d.ts
│  │  │  │  ├─ create-vta-comprobante.dto.js
│  │  │  │  ├─ create-vta-comprobante.dto.js.map
│  │  │  │  ├─ update-vta-comprobante.dto.d.ts
│  │  │  │  ├─ update-vta-comprobante.dto.js
│  │  │  │  └─ update-vta-comprobante.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta-comprobante.entity.d.ts
│  │  │  │  ├─ vta-comprobante.entity.js
│  │  │  │  └─ vta-comprobante.entity.js.map
│  │  │  ├─ vta-comprobante.controller.d.ts
│  │  │  ├─ vta-comprobante.controller.js
│  │  │  ├─ vta-comprobante.controller.js.map
│  │  │  ├─ vta-comprobante.module.d.ts
│  │  │  ├─ vta-comprobante.module.js
│  │  │  ├─ vta-comprobante.module.js.map
│  │  │  ├─ vta-comprobante.service.d.ts
│  │  │  ├─ vta-comprobante.service.js
│  │  │  └─ vta-comprobante.service.js.map
│  │  ├─ vta-comprobante-item
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta-comprobante-item.dto.d.ts
│  │  │  │  ├─ create-vta-comprobante-item.dto.js
│  │  │  │  ├─ create-vta-comprobante-item.dto.js.map
│  │  │  │  ├─ update-vta-comprobante-item.dto.d.ts
│  │  │  │  ├─ update-vta-comprobante-item.dto.js
│  │  │  │  └─ update-vta-comprobante-item.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta-comprobante-item.entity.d.ts
│  │  │  │  ├─ vta-comprobante-item.entity.js
│  │  │  │  └─ vta-comprobante-item.entity.js.map
│  │  │  ├─ vta-comprobante-item.controller.d.ts
│  │  │  ├─ vta-comprobante-item.controller.js
│  │  │  ├─ vta-comprobante-item.controller.js.map
│  │  │  ├─ vta-comprobante-item.module.d.ts
│  │  │  ├─ vta-comprobante-item.module.js
│  │  │  ├─ vta-comprobante-item.module.js.map
│  │  │  ├─ vta-comprobante-item.service.d.ts
│  │  │  ├─ vta-comprobante-item.service.js
│  │  │  └─ vta-comprobante-item.service.js.map
│  │  ├─ vta_cliente
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta_cliente.dto.d.ts
│  │  │  │  ├─ create-vta_cliente.dto.js
│  │  │  │  ├─ create-vta_cliente.dto.js.map
│  │  │  │  ├─ update-vta_cliente.dto.d.ts
│  │  │  │  ├─ update-vta_cliente.dto.js
│  │  │  │  └─ update-vta_cliente.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta_cliente.entity.d.ts
│  │  │  │  ├─ vta_cliente.entity.js
│  │  │  │  └─ vta_cliente.entity.js.map
│  │  │  ├─ vta_cliente.controller.d.ts
│  │  │  ├─ vta_cliente.controller.js
│  │  │  ├─ vta_cliente.controller.js.map
│  │  │  ├─ vta_cliente.module.d.ts
│  │  │  ├─ vta_cliente.module.js
│  │  │  ├─ vta_cliente.module.js.map
│  │  │  ├─ vta_cliente.service.d.ts
│  │  │  ├─ vta_cliente.service.js
│  │  │  └─ vta_cliente.service.js.map
│  │  ├─ vta_comprobante_asiento
│  │  │  ├─ dto
│  │  │  │  ├─ create-vta_comprobante_asiento.dto.d.ts
│  │  │  │  ├─ create-vta_comprobante_asiento.dto.js
│  │  │  │  ├─ create-vta_comprobante_asiento.dto.js.map
│  │  │  │  ├─ update-vta_comprobante_asiento.dto.d.ts
│  │  │  │  ├─ update-vta_comprobante_asiento.dto.js
│  │  │  │  └─ update-vta_comprobante_asiento.dto.js.map
│  │  │  ├─ entities
│  │  │  │  ├─ vta_comprobante_asiento.entity.d.ts
│  │  │  │  ├─ vta_comprobante_asiento.entity.js
│  │  │  │  └─ vta_comprobante_asiento.entity.js.map
│  │  │  ├─ vta_comprobante_asiento.controller.d.ts
│  │  │  ├─ vta_comprobante_asiento.controller.js
│  │  │  ├─ vta_comprobante_asiento.controller.js.map
│  │  │  ├─ vta_comprobante_asiento.module.d.ts
│  │  │  ├─ vta_comprobante_asiento.module.js
│  │  │  ├─ vta_comprobante_asiento.module.js.map
│  │  │  ├─ vta_comprobante_asiento.service.d.ts
│  │  │  ├─ vta_comprobante_asiento.service.js
│  │  │  └─ vta_comprobante_asiento.service.js.map
│  │  └─ whatsapp
│  │     ├─ whatsapp.module.d.ts
│  │     ├─ whatsapp.module.js
│  │     ├─ whatsapp.module.js.map
│  │     ├─ whatsapp.service.d.ts
│  │     ├─ whatsapp.service.js
│  │     └─ whatsapp.service.js.map
│  └─ tsconfig.build.tsbuildinfo
├─ docker-compose.yml
├─ eslint.config.mjs
├─ nest-cli.json
├─ package-lock.json
├─ package.json
├─ scripts
│  └─ test-notify.ts
├─ src
│  ├─ app.controller.ts
│  ├─ app.module.ts
│  ├─ app.service.ts
│  ├─ bas-moneda
│  │  ├─ bas-moneda.controller.ts
│  │  ├─ bas-moneda.module.ts
│  │  ├─ bas-moneda.service.ts
│  │  ├─ dto
│  │  │  ├─ create-bas-moneda.dto.ts
│  │  │  └─ update-bas-moneda.dto.ts
│  │  └─ entities
│  │     └─ bas-moneda.entity.ts
│  ├─ cnt-asiento
│  │  ├─ cnt-asiento.controller.ts
│  │  ├─ cnt-asiento.module.ts
│  │  ├─ cnt-asiento.service.ts
│  │  ├─ dto
│  │  │  ├─ create-cnt-asiento.dto.ts
│  │  │  └─ update-cnt-asiento.dto.ts
│  │  └─ entities
│  │     └─ cnt-asiento.entity.ts
│  ├─ cnt-movimiento
│  │  ├─ cnt-movimiento.controller.ts
│  │  ├─ cnt-movimiento.module.ts
│  │  ├─ cnt-movimiento.service.ts
│  │  ├─ dto
│  │  │  ├─ create-cnt-movimiento.dto.ts
│  │  │  └─ update-cnt-movimiento.dto.ts
│  │  └─ entities
│  │     └─ cnt-movimiento.entity.ts
│  ├─ common
│  │  ├─ decorators
│  │  │  └─ auth-type.decorator.ts
│  │  ├─ filters
│  │  │  └─ http-exception.filter.ts
│  │  ├─ guards
│  │  │  └─ api-token.guard.ts
│  │  ├─ interceptors
│  │  │  └─ logging.interceptor.ts
│  │  └─ transformers
│  │     └─ bit-to-bool.transformer.ts
│  ├─ cupon
│  │  ├─ cupon.controller.ts
│  │  ├─ cupon.module.ts
│  │  ├─ cupon.service.ts
│  │  ├─ dto
│  │  │  ├─ create-cupon.dto.ts
│  │  │  └─ update-cupon.dto.ts
│  │  └─ entities
│  │     └─ cupon.entity.ts
│  ├─ cupon_uso
│  │  ├─ cupon_uso.controller.ts
│  │  ├─ cupon_uso.module.ts
│  │  ├─ cupon_uso.service.ts
│  │  ├─ dto
│  │  │  ├─ create-cupon_uso.dto.ts
│  │  │  └─ update-cupon_uso.dto.ts
│  │  └─ entities
│  │     └─ cupon_uso.entity.ts
│  ├─ mailer
│  │  ├─ mailer.module.ts
│  │  └─ mailer.service.ts
│  ├─ main.ts
│  ├─ maps
│  │  ├─ dto
│  │  │  └─ get-distance.dto.ts
│  │  ├─ maps.controller.ts
│  │  ├─ maps.module.ts
│  │  └─ maps.service.ts
│  ├─ pedido
│  │  ├─ dto
│  │  │  ├─ create-pedido.dto.ts
│  │  │  └─ update-pedido.dto.ts
│  │  ├─ entities
│  │  │  ├─ pedido-item.entity.ts
│  │  │  └─ pedido.entity.ts
│  │  ├─ pedido-expiration.service.ts
│  │  ├─ pedido.controller.ts
│  │  ├─ pedido.module.ts
│  │  └─ pedido.service.ts
│  ├─ stk-deposito
│  │  ├─ dto
│  │  │  ├─ create-stk-deposito.dto.ts
│  │  │  └─ update-stk-deposito.dto.ts
│  │  ├─ entities
│  │  │  └─ stk-deposito.entity.ts
│  │  ├─ stk-deposito.controller.ts
│  │  ├─ stk-deposito.module.ts
│  │  └─ stk-deposito.service.ts
│  ├─ stk-existencia
│  │  ├─ dto
│  │  │  ├─ create-stk-existencia.dto.ts
│  │  │  └─ update-stk-existencia.dto.ts
│  │  ├─ entities
│  │  │  └─ stk-existencia.entity.ts
│  │  ├─ stk-existencia.controller.ts
│  │  ├─ stk-existencia.module.ts
│  │  └─ stk-existencia.service.ts
│  ├─ stk-item
│  │  ├─ dto
│  │  │  ├─ create-stk-item.dto.ts
│  │  │  └─ update-stk-item.dto.ts
│  │  ├─ entities
│  │  │  └─ stk-item.entity.ts
│  │  ├─ stk-item.controller.ts
│  │  ├─ stk-item.module.ts
│  │  └─ stk-item.service.ts
│  ├─ stk-precio
│  │  ├─ dto
│  │  │  ├─ create-stk-precio.dto.ts
│  │  │  └─ update-stk-precio.dto.ts
│  │  ├─ entities
│  │  │  └─ stk-precio.entity.ts
│  │  ├─ stk-precio.controller.ts
│  │  ├─ stk-precio.module.ts
│  │  └─ stk-precio.service.ts
│  ├─ stk_familia
│  │  ├─ dto
│  │  │  ├─ create-stk_familia.dto.ts
│  │  │  └─ update-stk_familia.dto.ts
│  │  ├─ entities
│  │  │  └─ stk_familia.entity.ts
│  │  ├─ stk_familia.controller.ts
│  │  ├─ stk_familia.module.ts
│  │  └─ stk_familia.service.ts
│  ├─ sys_image
│  │  ├─ dto
│  │  │  ├─ create-sys_image.dto.ts
│  │  │  └─ update-sys_image.dto.ts
│  │  ├─ entities
│  │  │  └─ sys_image.entity.ts
│  │  ├─ sys_image.controller.ts
│  │  ├─ sys_image.module.ts
│  │  └─ sys_image.service.ts
│  ├─ vta-cobro
│  │  ├─ dto
│  │  │  ├─ create-vta-cobro.dto.ts
│  │  │  └─ update-vta-cobro.dto.ts
│  │  ├─ entities
│  │  │  └─ vta-cobro.entity.ts
│  │  ├─ vta-cobro.controller.ts
│  │  ├─ vta-cobro.module.ts
│  │  └─ vta-cobro.service.ts
│  ├─ vta-cobro-factura
│  │  ├─ dto
│  │  │  ├─ create-vta-cobro-factura.dto.ts
│  │  │  └─ update-vta-cobro-factura.dto.ts
│  │  ├─ entities
│  │  │  └─ vta-cobro-factura.entity.ts
│  │  ├─ vta-cobro-factura.controller.ts
│  │  ├─ vta-cobro-factura.module.ts
│  │  └─ vta-cobro-factura.service.ts
│  ├─ vta-cobro-medio
│  │  ├─ dto
│  │  │  ├─ create-vta-cobro-medio.dto.ts
│  │  │  └─ update-vta-cobro-medio.dto.ts
│  │  ├─ entities
│  │  │  └─ vta-cobro-medio.entity.ts
│  │  ├─ vta-cobro-medio.controller.ts
│  │  ├─ vta-cobro-medio.module.ts
│  │  └─ vta-cobro-medio.service.ts
│  ├─ vta-comprobante
│  │  ├─ cobros.service.ts
│  │  ├─ dto
│  │  │  ├─ cobrar-factura.dto.ts
│  │  │  ├─ create-vta-comprobante.dto.ts
│  │  │  └─ update-vta-comprobante.dto.ts
│  │  ├─ entities
│  │  │  └─ vta-comprobante.entity.ts
│  │  ├─ vta-comprobante.controller.ts
│  │  ├─ vta-comprobante.module.ts
│  │  └─ vta-comprobante.service.ts
│  ├─ vta-comprobante-item
│  │  ├─ dto
│  │  │  ├─ create-vta-comprobante-item.dto.ts
│  │  │  └─ update-vta-comprobante-item.dto.ts
│  │  ├─ entities
│  │  │  └─ vta-comprobante-item.entity.ts
│  │  ├─ vta-comprobante-item.controller.ts
│  │  ├─ vta-comprobante-item.module.ts
│  │  └─ vta-comprobante-item.service.ts
│  ├─ vta_cliente
│  │  ├─ dto
│  │  │  ├─ create-vta_cliente.dto.ts
│  │  │  └─ update-vta_cliente.dto.ts
│  │  ├─ entities
│  │  │  └─ vta_cliente.entity.ts
│  │  ├─ vta_cliente.controller.ts
│  │  ├─ vta_cliente.module.ts
│  │  └─ vta_cliente.service.ts
│  ├─ vta_comprobante_asiento
│  │  ├─ dto
│  │  │  ├─ create-vta_comprobante_asiento.dto.ts
│  │  │  └─ update-vta_comprobante_asiento.dto.ts
│  │  ├─ entities
│  │  │  └─ vta_comprobante_asiento.entity.ts
│  │  ├─ vta_comprobante_asiento.controller.ts
│  │  ├─ vta_comprobante_asiento.module.ts
│  │  └─ vta_comprobante_asiento.service.ts
│  └─ whatsapp
│     ├─ whatsapp.module.ts
│     └─ whatsapp.service.ts
├─ test
│  ├─ app.e2e-spec.ts
│  └─ jest-e2e.json
├─ tsconfig.build.json
└─ tsconfig.json

```