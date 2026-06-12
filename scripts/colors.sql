CREATE TABLE IF NOT EXISTS color_groups (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  hex VARCHAR(7) NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_color_groups_name (name)
);

CREATE TABLE IF NOT EXISTS colors (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  hex VARCHAR(7) NOT NULL,
  color_group_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_colors_name (name),
  KEY idx_colors_color_group_id (color_group_id),
  CONSTRAINT fk_colors_color_group
    FOREIGN KEY (color_group_id)
    REFERENCES color_groups(id)
);

INSERT INTO colors (name, hex)
VALUES
  ('Amarillo', '#FFFF00'),
  ('Amarillo Fluo', '#FFFF00'),
  ('Blanco', '#FFFFFF')
ON DUPLICATE KEY UPDATE
  hex = VALUES(hex),
  updated_at = CURRENT_TIMESTAMP;
