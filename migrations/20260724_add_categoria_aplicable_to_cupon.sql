ALTER TABLE `cupon`
  ADD COLUMN `categoria_aplicable` enum('filamento','impresora','repuesto') NULL AFTER `cuit_habilitado`;
