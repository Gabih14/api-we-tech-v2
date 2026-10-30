-- Ejecutar en la base propia (BACK_DB_NAME), antes de desplegar la API.
ALTER TABLE `pedido`
  ADD COLUMN `motivo_cancelacion` varchar(255) NULL AFTER `estado`,
  ADD COLUMN `recuperado` timestamp NULL DEFAULT NULL AFTER `creado`;
