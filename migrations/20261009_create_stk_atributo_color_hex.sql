-- Ejecutar sobre la base del ERP (DB_NAME / wetechv2).
CREATE TABLE stk_atributo_color_hex (
  id INT NOT NULL AUTO_INCREMENT,
  atributo_id VARCHAR(10) NOT NULL,
  hex VARCHAR(11) NOT NULL,
  orden INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stk_atributo_color_hex_orden (atributo_id, orden),
  UNIQUE KEY uq_stk_atributo_color_hex_valor (atributo_id, hex),
  CONSTRAINT fk_stk_atributo_color_hex_atributo
    FOREIGN KEY (atributo_id) REFERENCES stk_atributo (id)
    ON DELETE CASCADE
);

INSERT INTO stk_atributo_color_hex (atributo_id, hex, orden)
SELECT id, UPPER(TRIM(color)), 0
FROM stk_atributo
WHERE clase = 'Colores'
  AND color IS NOT NULL
  AND TRIM(color) <> '';
