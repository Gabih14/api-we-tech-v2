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

  function createService() {
    const pedidoRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const service = new PedidoExpirationService(
      pedidoRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, pedidoRepo };
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
});
