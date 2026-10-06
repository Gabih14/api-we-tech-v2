-- Primero se admiten ambos valores para poder migrar los registros existentes.
ALTER TABLE ecommerce_usuario
  MODIFY COLUMN perfil_compra_inicial ENUM(
    'GRAN_CONSUMIDOR_FINAL_12_239_KG',
    'GRAN_CONSUMIDOR_FINAL_96_239_KG',
    'PUNTO_VENTA_OFICIAL_240_479_KG',
    'PUNTO_VENTA_PLUS_480_KG',
    'PLUS_960_KG',
    'NIVEL_SUPERIOR_2_TN',
    'NIVEL_SUPERIOR_4_TN'
  ) NULL;

UPDATE ecommerce_usuario
SET perfil_compra_inicial = 'GRAN_CONSUMIDOR_FINAL_96_239_KG'
WHERE perfil_compra_inicial = 'GRAN_CONSUMIDOR_FINAL_12_239_KG';

-- Una vez migrados los datos, se retira la opcion anterior.
ALTER TABLE ecommerce_usuario
  MODIFY COLUMN perfil_compra_inicial ENUM(
    'GRAN_CONSUMIDOR_FINAL_96_239_KG',
    'PUNTO_VENTA_OFICIAL_240_479_KG',
    'PUNTO_VENTA_PLUS_480_KG',
    'PLUS_960_KG',
    'NIVEL_SUPERIOR_2_TN',
    'NIVEL_SUPERIOR_4_TN'
  ) NULL;
