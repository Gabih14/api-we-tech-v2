-- Ejecutar sobre la base propia (BACK_DB_NAME / we_tech_back).
-- Las bases pueden estar en servidores distintos. El cruce con stk_atributo se
-- realiza luego mediante POST /colors/migrate-legacy, usando ambas conexiones.
ALTER TABLE colors
  ADD COLUMN stk_atributo_id VARCHAR(10) NULL AFTER id;

-- Las columnas legacy quedan temporalmente solo para no perder colores que aun
-- no tengan equivalente en el ERP. La aplicacion deja de leerlas/escribirlas.
ALTER TABLE colors
  MODIFY name VARCHAR(100) NULL,
  MODIFY hex VARCHAR(7) NULL,
  ADD UNIQUE KEY uq_colors_stk_atributo_id (stk_atributo_id);

-- Revisar luego de migrar. Estas filas deben vincularse manualmente o eliminarse
-- antes de retirar definitivamente name y hex.
SELECT id, name, hex, color_group_id
FROM colors
WHERE stk_atributo_id IS NULL;
