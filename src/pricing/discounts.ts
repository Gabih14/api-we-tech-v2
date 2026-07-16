export type ProductDiscountInput = {
  id: string;
  category?: string | null;
};

export type DiscountLevel = {
  quantity: number;
  discount: string;
};

export const QUANTITY_DISCOUNTS = {
  1: 0.15,
  5: 0.17,
  10: 0.2,
  50: 0.22,
} as const;

export const BASE_FILAMENT_DISCOUNT = 0.15;

export const ELIGIBLE_BRANDS_FOR_QUANTITY_DISCOUNT = [
  '3N-PLA', // 3N3 PLA
  'G3-BOUT', // G3 PLA BOUTIQUE
  'G3-PLA', // GRILON3-PLA
  'GS-PLA', // GST3D-PLA
  'HB-PLA', // HELLBOT-PLA
  '3X-PLA', // 3NMAX-PLA
  'FM-PLA', // FREMOVER-PLA
  'EG-PLA', // ELEGOO-PLA
] as const;

export const FILAMENT_CATEGORIES = ['FILAMENTO 3D', 'FILAMENTOS'] as const;

export const DISCOUNT_RULES: Record<
  string,
  { discounts: Record<number, number> }
> = {
  ...FILAMENT_CATEGORIES.reduce(
    (acc, key) => {
      acc[key] = { discounts: { ...QUANTITY_DISCOUNTS } };
      return acc;
    },
    {} as Record<string, { discounts: Record<number, number> }>,
  ),
};

export const roundPrice = (value: number): number => Math.round(value);

const getTieredDiscount = (
  discounts: Record<number, number>,
  quantity: number,
): number => {
  const thresholds = Object.keys(discounts)
    .map((key) => Number(key))
    .sort((a, b) => a - b);

  let rate = 0;
  for (const threshold of thresholds) {
    if (quantity >= threshold) {
      rate = discounts[threshold];
    }
  }
  return rate;
};

export const shouldApplyDiscount = (product: ProductDiscountInput): boolean =>
  Boolean(product.category && DISCOUNT_RULES[product.category]);

export const normalizeProductBrandForQuantityDiscount = (
  productId: string,
): string | null => {
  const [brandPrefix, family] = productId.toUpperCase().split('-');
  if (!brandPrefix || !family) {
    return null;
  }

  const normalizedFamily = family.replace(/\d+$/, '');
  if (!normalizedFamily) {
    return null;
  }

  return `${brandPrefix}-${normalizedFamily}`;
};

export const isEligibleForQuantityDiscount = (
  product: ProductDiscountInput,
  weight: number,
): boolean => {
  if (!shouldApplyDiscount(product)) {
    return false;
  }

  if (weight !== 1) {
    return false;
  }

  const productBrand = normalizeProductBrandForQuantityDiscount(product.id);
  return Boolean(
    productBrand &&
      ELIGIBLE_BRANDS_FOR_QUANTITY_DISCOUNT.includes(
        productBrand as (typeof ELIGIBLE_BRANDS_FOR_QUANTITY_DISCOUNT)[number],
      ),
  );
};

// ---------------------------------------------------------------------------
// Elegibilidad por ATRIBUTOS (Marca + Material). Fuente de verdad confiable que
// reemplaza el parseo frágil de prefijos de id: un mismo Marca+Material puede
// tener muchos prefijos (G3-PLA / G3-PLA1 / G3-PLA2 / G3-MEGA, GSC-PLA / GSL-PLA…)
// y con atributos todos resuelven al mismo par.
// ---------------------------------------------------------------------------

export type FilamentIdentity = {
  category?: string | null;
  marca?: string | null;
  material?: string | null;
};

/**
 * Pares (Marca, Material) de filamentos con descuento por cantidad. Reproduce el
 * alcance histórico de {@link ELIGIBLE_BRANDS_FOR_QUANTITY_DISCOUNT} pero por
 * atributos. Editar acá para agregar/quitar líneas elegibles.
 */
export const ELIGIBLE_FILAMENT_ATTRIBUTES: ReadonlyArray<{
  marca: string;
  material: string;
}> = [
  { marca: '3n3', material: 'PLA' }, // 3N-PLA
  { marca: 'Grilon3', material: 'PLA' }, // G3-PLA (+ G3-PLA1/PLA2/MEGA)
  { marca: 'Grilon3', material: 'PLA Boutique' }, // G3-BOUT
  { marca: 'GST3D', material: 'PLA' }, // GS-PLA (real: GSC-PLA / GSL-PLA)
  { marca: 'Hellbot', material: 'PLA' }, // HB-PLA
  { marca: '3nMax', material: 'PLA+ Matte' }, // 3X-PLA
  { marca: 'Fremover', material: 'High Speed PLA' }, // FM-PLA
  { marca: 'Fremover', material: 'High Speed PLA Matte' }, // FM-PLA (matte)
  { marca: 'Elegoo', material: 'PLA' }, // EG-PLA
];

const normalizeAttribute = (value?: string | null): string =>
  (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

const ELIGIBLE_ATTRIBUTE_KEYS = new Set(
  ELIGIBLE_FILAMENT_ATTRIBUTES.map(
    (e) => `${normalizeAttribute(e.marca)}|${normalizeAttribute(e.material)}`,
  ),
);

export const isEligibleForQuantityDiscountByAttributes = (
  identity: FilamentIdentity,
  weight: number,
): boolean => {
  if (!shouldApplyDiscount({ id: '', category: identity.category })) {
    return false;
  }
  if (weight !== 1) {
    return false;
  }
  return ELIGIBLE_ATTRIBUTE_KEYS.has(
    `${normalizeAttribute(identity.marca)}|${normalizeAttribute(identity.material)}`,
  );
};

export const getDiscountPercentageForFilament = (
  identity: FilamentIdentity,
  quantity: number,
  weight?: number,
): string => {
  const productoCategoria = { id: '', category: identity.category };
  if (!shouldApplyDiscount(productoCategoria)) {
    return '0%';
  }
  if (
    weight !== undefined &&
    isEligibleForQuantityDiscountByAttributes(identity, weight)
  ) {
    const rate = getDiscountForQuantityForProduct(productoCategoria, quantity);
    return `${Math.round(rate * 100)}%`;
  }
  return `${Math.round(BASE_FILAMENT_DISCOUNT * 100)}%`;
};

export const getDiscountForQuantityForProduct = (
  product: ProductDiscountInput,
  quantity: number,
): number => {
  if (!product.category) {
    return 0;
  }

  const rule = DISCOUNT_RULES[product.category];
  if (!rule) {
    return 0;
  }

  return getTieredDiscount(rule.discounts, quantity);
};

export const calculateDiscountedPriceForProduct = (
  product: ProductDiscountInput,
  originalPrice: number,
  quantity: number,
  weight?: number,
): number => {
  if (!shouldApplyDiscount(product)) {
    return roundPrice(originalPrice);
  }

  if (weight !== undefined && isEligibleForQuantityDiscount(product, weight)) {
    const rate = getDiscountForQuantityForProduct(product, quantity);
    return roundPrice(originalPrice * (1 - rate));
  }

  return roundPrice(originalPrice * (1 - BASE_FILAMENT_DISCOUNT));
};

export const getDiscountPercentageForProduct = (
  product: ProductDiscountInput,
  quantity: number,
  weight?: number,
): string => {
  if (!shouldApplyDiscount(product)) {
    return '0%';
  }

  if (weight !== undefined && isEligibleForQuantityDiscount(product, weight)) {
    const rate = getDiscountForQuantityForProduct(product, quantity);
    return `${Math.round(rate * 100)}%`;
  }

  return `${Math.round(BASE_FILAMENT_DISCOUNT * 100)}%`;
};

export const isDiscountAppliedForProduct = (
  product: ProductDiscountInput,
  quantity: number,
): boolean => getDiscountForQuantityForProduct(product, quantity) > 0;

export const getDiscountForQuantity = (quantity: number): number => {
  if (quantity >= 50) return QUANTITY_DISCOUNTS[50];
  if (quantity >= 10) return QUANTITY_DISCOUNTS[10];
  if (quantity >= 5) return QUANTITY_DISCOUNTS[5];
  return QUANTITY_DISCOUNTS[1];
};

export const calculateDiscountedPrice = (
  originalPrice: number,
  quantity: number,
): number => {
  const discount = getDiscountForQuantity(quantity);
  return roundPrice(originalPrice * (1 - discount));
};

export const getDiscountPercentage = (quantity: number): string => {
  const discount = getDiscountForQuantity(quantity);
  return `${Math.round(discount * 100)}%`;
};

export const calculateSavings = (
  originalPrice: number,
  quantity: number,
): number => {
  const discount = getDiscountForQuantity(quantity);
  return originalPrice * quantity * discount;
};

export const getNextDiscountLevel = (
  currentQuantity: number,
): DiscountLevel | null => {
  if (currentQuantity < 5) {
    return { quantity: 5, discount: '17%' };
  }
  if (currentQuantity < 10) {
    return { quantity: 10, discount: '20%' };
  }
  if (currentQuantity < 50) {
    return { quantity: 50, discount: '22%' };
  }
  return null;
};

export const calculateSavingsForProduct = (
  product: ProductDiscountInput,
  originalPrice: number,
  quantity: number,
  weight?: number,
): number => {
  if (!shouldApplyDiscount(product)) {
    return 0;
  }

  if (weight !== undefined && isEligibleForQuantityDiscount(product, weight)) {
    const rate = getDiscountForQuantityForProduct(product, quantity);
    return originalPrice * quantity * rate;
  }

  return originalPrice * quantity * BASE_FILAMENT_DISCOUNT;
};

export const getNextDiscountLevelForProduct = (
  product: ProductDiscountInput,
  currentQuantity: number,
  weight?: number,
): DiscountLevel | null => {
  if (weight === undefined || !isEligibleForQuantityDiscount(product, weight)) {
    return null;
  }

  if (!product.category) {
    return null;
  }

  const rule = DISCOUNT_RULES[product.category];
  if (!rule) {
    return null;
  }

  const thresholds = Object.keys(rule.discounts)
    .map((key) => Number(key))
    .sort((a, b) => a - b);

  for (const threshold of thresholds) {
    if (currentQuantity < threshold) {
      const rate = rule.discounts[threshold];
      return { quantity: threshold, discount: `${Math.round(rate * 100)}%` };
    }
  }

  return null;
};

// Backend mapping: category = stk_item.grupo; weight is parsed from stk_item.descripcion.
export const parseProductWeightFromDescription = (
  description?: string | null,
): number | undefined => {
  if (!description) {
    return undefined;
  }

  const normalized = description.toLowerCase().replace(',', '.');
  const kilogramMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kilogramMatch) {
    return Number(kilogramMatch[1]);
  }

  const gramMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:g|gr)\b/);
  if (gramMatch) {
    return Number((Number(gramMatch[1]) / 1000).toFixed(3));
  }

  return undefined;
};
