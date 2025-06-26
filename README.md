

# 📦 API WeTech V2

API desarrollada con **NestJS**, orientada a la gestión de stock, pedidos y operaciones de venta para una plataforma de e-commerce.  
Integra servicios de pago externos (como **Nave**) y módulos de catálogo, stock, comprobantes y más.

---

## 🚀 Instalación

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/api-we-tech-v2.git
cd api-we-tech-v2

# Instala las dependencias
npm install

---

## 🛠️ Variables de entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes claves mínimas:

```env
GOOGLE_API_KEY=AIzaSyCDesHGPMQEk72w8X9sFRu1O1rzno9UopQ
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
