jest.mock('./pedido.service', () => ({
  PedidoService: class PedidoService {},
}));

import { PedidoExpirationService } from './pedido-expiration.service';

describe('PedidoExpirationService', () => {
  const originalEnabled = process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;
    } else {
      process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED = originalEnabled;
    }
  });

  function createService(pedidos: any[] = []) {
    const pedidoRepo = {
      find: jest.fn().mockResolvedValue(pedidos),
    };
    const cobrosService = {
      tieneCobroFacturaDelPedido: jest.fn().mockResolvedValue(false),
    };
    const pedidoService = {
      aprobarTransferencia: jest.fn(),
    };

    const service = new PedidoExpirationService(
      pedidoRepo as any,
      {} as any,
      cobrosService as any,
      pedidoService as any,
    );

    return { service, pedidoRepo, cobrosService, pedidoService };
  }

  it.each(['false', '0', 'no', 'off', ' FALSE '])(
    'pausa la aprobacion automatica con %s',
    async (value) => {
      process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED = value;
      const { service, pedidoRepo } = createService();

      await service.scheduledTransferApproval();

      expect(pedidoRepo.find).not.toHaveBeenCalled();
    },
  );

  it('mantiene la aprobacion habilitada por defecto', async () => {
    delete process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;
    const { service, pedidoRepo } = createService();

    await service.scheduledTransferApproval();

    expect(pedidoRepo.find).toHaveBeenCalledTimes(1);
  });

  it('no aprueba cuando el comprobante cobrado no pertenece al pedido', async () => {
    delete process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;
    const pedido = {
      external_id: 'pedido-eliminado',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000001',
    };
    const { service, cobrosService, pedidoService } = createService([pedido]);

    await service.scheduledTransferApproval();

    expect(cobrosService.tieneCobroFacturaDelPedido).toHaveBeenCalledWith(
      'FX',
      'X 00001 00000001',
      pedido,
    );
    expect(pedidoService.aprobarTransferencia).not.toHaveBeenCalled();
  });
});
