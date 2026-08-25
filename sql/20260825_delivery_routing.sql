ALTER TABLE delivery_config
  ADD COLUMN activo BIT(1) NOT NULL DEFAULT b'1' AFTER kms,
  ADD INDEX idx_delivery_config_routing (activo, provincia, departamento, kms);

ALTER TABLE pedido
  ADD COLUMN distancia_envio DECIMAL(8,2) NULL AFTER costo_envio,
  ADD COLUMN provincia_envio VARCHAR(100) NULL AFTER distancia_envio,
  ADD COLUMN departamento_envio VARCHAR(100) NULL AFTER provincia_envio,
  ADD COLUMN delivery_config_id INT NULL AFTER departamento_envio,
  ADD INDEX idx_pedido_delivery_config (delivery_config_id),
  ADD CONSTRAINT fk_pedido_delivery_config
    FOREIGN KEY (delivery_config_id)
    REFERENCES delivery_config(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
