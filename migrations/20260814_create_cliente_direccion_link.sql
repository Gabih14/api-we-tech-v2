CREATE TABLE `cliente_direccion_link` (
  `cliente_id` varchar(20) NOT NULL,
  `link` varchar(1024) NOT NULL,
  `direccion_texto` varchar(512) NULL,
  `etiqueta` varchar(100) NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cliente_id`)
);
