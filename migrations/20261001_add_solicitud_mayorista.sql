ALTER TABLE ecommerce_usuario
  ADD COLUMN cuit VARCHAR(11) NULL AFTER cliente_id,
  ADD COLUMN razon_social VARCHAR(100) NULL AFTER cuit,
  ADD COLUMN telefono VARCHAR(30) NULL AFTER razon_social;
