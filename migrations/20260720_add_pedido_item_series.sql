-- Ejecutar exclusivamente sobre la base propia (BACK_DB_NAME).

CREATE TABLE pedido_item_config (
  item varchar(20) NOT NULL,
  controla_serie tinyint(1) NOT NULL DEFAULT 0,
  habilitado_web tinyint(1) NOT NULL DEFAULT 1,
  creado_en datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (item)
);

ALTER TABLE pedido_item
  ADD COLUMN deposito varchar(20) NULL AFTER ajuste_porcentaje;

CREATE TABLE pedido_item_serie (
  id bigint NOT NULL AUTO_INCREMENT,
  pedido_id int NOT NULL,
  pedido_item_id int NOT NULL,
  item varchar(20) NOT NULL,
  serie varchar(40) NOT NULL,
  estado enum('RESERVADA','CONFIRMANDO','CONFIRMADA','LIBERADA','CANCELADA','ERROR')
    NOT NULL DEFAULT 'RESERVADA',
  reservada_en datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en datetime NULL,
  confirmada_en datetime NULL,
  liberada_en datetime NULL,
  comprobante_tipo varchar(4) NULL,
  comprobante varchar(16) NULL,
  comprobante_linea int NULL,
  error_detalle text NULL,
  reserva_activa varchar(80) GENERATED ALWAYS AS (
    CASE
      WHEN estado IN ('RESERVADA','CONFIRMANDO','CONFIRMADA')
      THEN concat(item, '#', serie)
      ELSE NULL
    END
  ) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pedido_item_serie_activa (reserva_activa),
  KEY idx_pedido_item_serie_pedido (pedido_id),
  KEY idx_pedido_item_serie_item (pedido_item_id),
  CONSTRAINT fk_pedido_item_serie_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedido (id),
  CONSTRAINT fk_pedido_item_serie_item
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_item (id)
);

-- Carga inicial conservadora. Agregar el resto de los equipos sólo después de
-- validar que stk_existencia y stk_numero_serie coincidan.
INSERT INTO pedido_item_config (item, controla_serie, habilitado_web) VALUES
  ('BL-A1', 1, 1),
  ('BL-A1COMBO', 1, 1)
ON DUPLICATE KEY UPDATE
  controla_serie = VALUES(controla_serie),
  habilitado_web = VALUES(habilitado_web);
