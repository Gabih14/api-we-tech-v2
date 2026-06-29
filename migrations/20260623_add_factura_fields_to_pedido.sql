ALTER TABLE pedido
  ADD COLUMN factura_tipo varchar(1) NULL,
  ADD COLUMN factura_iva_porcentaje decimal(5,2) NULL,
  ADD COLUMN factura_iva_importe decimal(12,2) NULL;
