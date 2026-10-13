-- Ejecutar sobre la base propia (BACK_DB_NAME / we_tech_back).
ALTER TABLE colors
  ADD COLUMN franja_horizontal BOOLEAN NOT NULL DEFAULT FALSE AFTER color_group_id;
