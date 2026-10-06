ALTER TABLE ecommerce_usuario
  ADD COLUMN nombre_comercio VARCHAR(120) NULL AFTER telefono,
  ADD COLUMN persona_responsable VARCHAR(120) NULL AFTER nombre_comercio,
  ADD COLUMN ubicacion_zona VARCHAR(150) NULL AFTER persona_responsable,
  ADD COLUMN figura_fiscal_comercial ENUM(
    'EMPRENDEDOR_CONSUMIDOR_FINAL',
    'EMPRENDEDOR_MONOTRIBUTISTA',
    'RESPONSABLE_INSCRIPTO',
    'SOCIEDAD_SIMPLE',
    'SOCIEDAD_ESTANDAR'
  ) NULL AFTER ubicacion_zona,
  ADD COLUMN perfil_compra_inicial ENUM(
    'GRAN_CONSUMIDOR_FINAL_12_239_KG',
    'PUNTO_VENTA_OFICIAL_240_479_KG',
    'PUNTO_VENTA_PLUS_480_KG',
    'PLUS_960_KG',
    'NIVEL_SUPERIOR_2_TN',
    'NIVEL_SUPERIOR_4_TN'
  ) NULL AFTER figura_fiscal_comercial,
  ADD COLUMN sede_comercial ENUM(
    'TALLER_OFICINA',
    'LOCAL_PUBLICO'
  ) NULL AFTER perfil_compra_inicial,
  ADD COLUMN ofertas_publico JSON NULL AFTER sede_comercial,
  ADD COLUMN marcas_filamento VARCHAR(500) NULL AFTER ofertas_publico;
