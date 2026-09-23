-- Ejecutar sobre la base propia (BACK_DB_NAME / we_tech_back).
ALTER TABLE colors
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE AFTER color_group_id;
