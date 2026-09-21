import { mapNavePaymentToCobroInput } from './nave-payment.mapper';

describe('mapNavePaymentToCobroInput', () => {
  it.each([
    ['CREDIT', 'CREDITO NAVE'],
    ['DEBIT', 'DEBITO NAVE'],
  ] as const)('mapea una tarjeta %s', (cardType, medioId) => {
    expect(
      mapNavePaymentToCobroInput({
        status: { name: 'APPROVED' },
        payment_method: { type: 'card_payment', card_type: cardType },
        payment_code: 'PAY-1',
        transactions: [{ auth_data: { operation_id: 'OP-1' } }],
      }),
    ).toEqual({ modalidad: 'TARJETA', medioId, leyenda: 'OP-1' });
  });

  it('soporta el pago envuelto y usa payment_code como leyenda alternativa', () => {
    expect(
      mapNavePaymentToCobroInput({
        payment: {
          status: { name: 'APPROVED' },
          payment_method: { type: 'card_payment', card_type: 'CREDIT' },
          payment_code: 'PAY-2',
        },
      }),
    ).toEqual({
      modalidad: 'TARJETA',
      medioId: 'CREDITO NAVE',
      leyenda: 'PAY-2',
    });
  });

  it('mapea transfer_payment como debito Nave', () => {
    expect(
      mapNavePaymentToCobroInput({
        status: { name: 'APPROVED' },
        payment_method: { type: 'transfer_payment' },
        payment_code: 'PAY-TRANSFER-1',
      }),
    ).toEqual({
      modalidad: 'TARJETA',
      medioId: 'DEBITO NAVE',
      leyenda: 'PAY-TRANSFER-1',
    });
  });

  it.each([
    [{ status: { name: 'APPROVED' } }, 'Medio de pago'],
    [
      {
        status: { name: 'APPROVED' },
        payment_method: { type: 'account_money' },
      },
      'Medio de pago',
    ],
    [
      {
        status: { name: 'APPROVED' },
        payment_method: { type: 'card_payment' },
      },
      'Tipo de tarjeta',
    ],
    [
      {
        status: { name: 'APPROVED' },
        payment_method: { type: 'card_payment', card_type: 'PREPAID' },
      },
      'Tipo de tarjeta',
    ],
  ])('rechaza un pago aprobado no contemplado', (raw, message) => {
    expect(() => mapNavePaymentToCobroInput(raw)).toThrow(message);
  });
});
