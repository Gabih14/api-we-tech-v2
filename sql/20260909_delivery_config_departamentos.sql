CREATE TABLE delivery_config_departamento (
  id INT NOT NULL AUTO_INCREMENT,
  delivery_config_id INT NOT NULL,
  departamento VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_config_departamento (delivery_config_id, departamento),
  INDEX idx_delivery_config_departamento_nombre (departamento),
  CONSTRAINT fk_delivery_config_departamento
    FOREIGN KEY (delivery_config_id)
    REFERENCES delivery_config(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

INSERT INTO delivery_config_departamento (delivery_config_id, departamento)
SELECT id, TRIM(departamento)
FROM delivery_config
WHERE departamento IS NOT NULL
  AND TRIM(departamento) <> '';

ALTER TABLE delivery_config
  DROP INDEX idx_delivery_config_routing,
  DROP COLUMN departamento,
  ADD INDEX idx_delivery_config_routing (activo, provincia, kms);
