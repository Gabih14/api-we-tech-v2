-- Ejecutar en la base propia (BACK_DB_NAME), donde vive pedido.
ALTER TABLE `pedido`
  ADD COLUMN `stock_reserva_id` varchar(36) NULL AFTER `external_id`,
  ADD KEY `idx_pedido_stock_reserva_id` (`stock_reserva_id`);
