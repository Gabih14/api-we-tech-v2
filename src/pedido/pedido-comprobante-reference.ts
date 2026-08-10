export const PEDIDO_COMPROBANTE_REFERENCE_PREFIX = 'PEDIDO_WEB:';

export function buildPedidoComprobanteReference(externalId: string): string {
  return `${PEDIDO_COMPROBANTE_REFERENCE_PREFIX}${externalId}`;
}
