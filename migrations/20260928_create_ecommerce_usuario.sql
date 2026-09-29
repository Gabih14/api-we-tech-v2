CREATE TABLE ecommerce_usuario (
  id INT NOT NULL AUTO_INCREMENT,
  clerk_user_id VARCHAR(255) NOT NULL,
  cliente_id VARCHAR(20) NULL,
  estado_mayorista ENUM(
    'NO_SOLICITADO',
    'PENDIENTE',
    'APROBADO',
    'RECHAZADO',
    'SUSPENDIDO'
  ) NOT NULL DEFAULT 'NO_SOLICITADO',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ecommerce_usuario_clerk_user_id (clerk_user_id),
  KEY idx_ecommerce_usuario_cliente_id (cliente_id)
);
