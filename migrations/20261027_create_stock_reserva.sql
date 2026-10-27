-- Ejecutar en la base ERP (DB_NAME), donde vive stk_existencia.
CREATE TABLE `stock_reserva` (
  `id` varchar(36) NOT NULL,
  `external_id` varchar(32) NOT NULL,
  `estado` enum('RESERVADA','CONFIRMADA','LIBERADA') NOT NULL,
  `motivo` varchar(255) NULL,
  `creado` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Compatible con MySQL antiguo: solo una columna TIMESTAMP automatica.
  -- TypeORM completa esta fecha al actualizar la entidad.
  `actualizado` datetime NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_reserva_external_id` (`external_id`),
  KEY `idx_stock_reserva_estado_creado` (`estado`, `creado`)
) ENGINE=InnoDB;

CREATE TABLE `stock_reserva_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reserva_id` varchar(36) NOT NULL,
  `item` varchar(20) NOT NULL,
  `deposito` varchar(20) NOT NULL,
  `cantidad` decimal(14,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stock_reserva_item_reserva` (`reserva_id`),
  KEY `idx_stock_reserva_item_busqueda` (`reserva_id`, `item`, `deposito`),
  CONSTRAINT `fk_stock_reserva_item_reserva`
    FOREIGN KEY (`reserva_id`) REFERENCES `stock_reserva` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `stock_reserva_evento` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reserva_id` varchar(36) NOT NULL,
  `tipo` varchar(40) NOT NULL,
  `motivo` varchar(255) NULL,
  `creado` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_reserva_evento_reserva_fecha` (`reserva_id`, `creado`),
  CONSTRAINT `fk_stock_reserva_evento_reserva`
    FOREIGN KEY (`reserva_id`) REFERENCES `stock_reserva` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
