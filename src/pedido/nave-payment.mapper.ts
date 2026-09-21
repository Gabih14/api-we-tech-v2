export interface NaveCobroInput {
  modalidad: 'TARJETA';
  medioId: 'CREDITO NAVE' | 'DEBITO NAVE';
  leyenda: string | null;
}

export function mapNavePaymentToCobroInput(raw: any): NaveCobroInput {
  const payment = raw?.payment ?? raw;
  const status = payment?.status?.name;
  const type = payment?.payment_method?.type;
  const cardType = payment?.payment_method?.card_type;

  if (status !== 'APPROVED') {
    throw new Error(`Estado Nave no cobrable: ${status ?? 'ausente'}`);
  }
  if (type === 'transfer_payment') {
    return {
      modalidad: 'TARJETA',
      medioId: 'DEBITO NAVE',
      leyenda: payment?.payment_code || null,
    };
  }
  if (type !== 'card_payment') {
    throw new Error(`Medio de pago Nave no soportado: ${type ?? 'ausente'}`);
  }
  if (cardType !== 'CREDIT' && cardType !== 'DEBIT') {
    throw new Error(
      `Tipo de tarjeta Nave no soportado: ${cardType ?? 'ausente'}`,
    );
  }

  return {
    modalidad: 'TARJETA',
    medioId: cardType === 'CREDIT' ? 'CREDITO NAVE' : 'DEBITO NAVE',
    leyenda:
      payment?.transactions?.[0]?.auth_data?.operation_id ||
      payment?.payment_code ||
      null,
  };
}
