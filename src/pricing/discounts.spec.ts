import {
  calculateDiscountedPrice,
  calculateDiscountedPriceForProduct,
  calculateSavings,
  calculateSavingsForProduct,
  getDiscountForQuantity,
  getDiscountForQuantityForProduct,
  getDiscountPercentage,
  getDiscountPercentageForProduct,
  getNextDiscountLevel,
  getNextDiscountLevelForProduct,
  isDiscountAppliedForProduct,
  isEligibleForQuantityDiscount,
  parseProductWeightFromDescription,
  shouldApplyDiscount,
} from './discounts';

describe('pricing discounts', () => {
  const eligibleFilament = {
    id: 'GST3D-PLA',
    category: 'FILAMENTOS',
  };
  const nonEligibleFilament = {
    id: 'OTRA-MARCA',
    category: 'FILAMENTOS',
  };
  const nonFilament = {
    id: 'IMP-1',
    category: 'IMPRESORAS',
  };

  it.each([
    [1, 0.15, '15%', 85],
    [5, 0.17, '17%', 83],
    [10, 0.2, '20%', 80],
    [50, 0.22, '22%', 78],
  ])(
    'aplica descuento por cantidad a filamento elegible 1kg para qty %s',
    (quantity, rate, percentage, discountedPrice) => {
      expect(
        isEligibleForQuantityDiscount(eligibleFilament, 1),
      ).toBeTruthy();
      expect(getDiscountForQuantityForProduct(eligibleFilament, quantity)).toBe(
        rate,
      );
      expect(
        getDiscountPercentageForProduct(eligibleFilament, quantity, 1),
      ).toBe(percentage);
      expect(
        calculateDiscountedPriceForProduct(
          eligibleFilament,
          100,
          quantity,
          1,
        ),
      ).toBe(discountedPrice);
    },
  );

  it('aplica siempre descuento base a filamento no elegible por peso o marca', () => {
    expect(calculateDiscountedPriceForProduct(eligibleFilament, 100, 50, 0.5))
      .toBe(85);
    expect(
      getDiscountPercentageForProduct(eligibleFilament, 50, 0.5),
    ).toBe('15%');
    expect(
      calculateDiscountedPriceForProduct(nonEligibleFilament, 100, 50, 1),
    ).toBe(85);
    expect(
      getDiscountPercentageForProduct(nonEligibleFilament, 50, 1),
    ).toBe('15%');
    expect(calculateSavingsForProduct(nonEligibleFilament, 100, 2, 1)).toBe(
      30,
    );
  });

  it('no aplica descuento a productos que no son filamento', () => {
    expect(shouldApplyDiscount(nonFilament)).toBe(false);
    expect(calculateDiscountedPriceForProduct(nonFilament, 100.49, 10, 1)).toBe(
      100,
    );
    expect(getDiscountPercentageForProduct(nonFilament, 10, 1)).toBe('0%');
    expect(calculateSavingsForProduct(nonFilament, 100, 10, 1)).toBe(0);
  });

  it('devuelve el siguiente tier correcto solo para productos elegibles', () => {
    expect(getNextDiscountLevelForProduct(eligibleFilament, 1, 1)).toEqual({
      quantity: 5,
      discount: '17%',
    });
    expect(getNextDiscountLevelForProduct(eligibleFilament, 5, 1)).toEqual({
      quantity: 10,
      discount: '20%',
    });
    expect(getNextDiscountLevelForProduct(eligibleFilament, 10, 1)).toEqual({
      quantity: 50,
      discount: '22%',
    });
    expect(getNextDiscountLevelForProduct(eligibleFilament, 50, 1)).toBeNull();
    expect(getNextDiscountLevelForProduct(nonEligibleFilament, 1, 1)).toBeNull();
  });

  it('mantiene funciones legacy', () => {
    expect(getDiscountForQuantity(1)).toBe(0.15);
    expect(getDiscountForQuantity(5)).toBe(0.17);
    expect(getDiscountForQuantity(10)).toBe(0.2);
    expect(getDiscountForQuantity(50)).toBe(0.22);
    expect(calculateDiscountedPrice(100, 10)).toBe(80);
    expect(getDiscountPercentage(50)).toBe('22%');
    expect(calculateSavings(100, 2)).toBe(30);
    expect(getNextDiscountLevel(1)).toEqual({
      quantity: 5,
      discount: '17%',
    });
    expect(getNextDiscountLevel(50)).toBeNull();
  });

  it('expone compatibilidad de descuento aplicado por producto', () => {
    expect(isDiscountAppliedForProduct(eligibleFilament, 1)).toBe(true);
    expect(isDiscountAppliedForProduct(nonFilament, 1)).toBe(false);
  });

  it.each([
    ['Filamento PLA 1kg negro', 1],
    ['Filamento PLA 1 kg negro', 1],
    ['Filamento PLA 1,0kg negro', 1],
    ['Filamento PLA 1000g negro', 1],
    ['Filamento PLA 1000 gr negro', 1],
    ['Filamento PLA 500g negro', 0.5],
    ['Filamento PLA negro', undefined],
  ])('parsea peso desde descripcion: %s', (description, expected) => {
    expect(parseProductWeightFromDescription(description)).toBe(expected);
  });
});
