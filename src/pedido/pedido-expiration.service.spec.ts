jest.mock('./pedido.service', () => ({
  PedidoService: class PedidoService {},
}));

import { PedidoExpirationService } from './pedido-expiration.service';

describe('PedidoExpirationService', () => {
  const originalEnabled = process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;

  afterEach(() => {
    jest.useRealTimers();

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
      cancelarPedidoPendiente: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PedidoExpirationService(
      pedidoRepo as any,
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

  it('cancela un pedido online expirado usando el flujo completo', async () => {
    const pedido = {
      external_id: 'pedido-online-expirado',
      metodo_pago: 'online',
    };
    const { service, pedidoRepo, pedidoService } = createService();
    pedidoRepo.find.mockResolvedValueOnce([pedido]).mockResolvedValueOnce([]);

    await expect(service.run(30)).resolves.toMatchObject({ expirados: 1 });

    expect(pedidoService.cancelarPedidoPendiente).toHaveBeenCalledWith(
      pedido.external_id,
      'Pedido cancelado automaticamente por expiracion',
    );
  });

  it('no cancela una transferencia expirada que ya tiene cobro', async () => {
    const pedido = {
      external_id: 'pedido-transfer-cobrado',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000002',
    };
    const { service, pedidoRepo, cobrosService, pedidoService } =
      createService();
    pedidoRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([pedido]);
    cobrosService.tieneCobroFacturaDelPedido.mockResolvedValueOnce(true);

    await expect(service.run(30)).resolves.toMatchObject({ expirados: 0 });

    expect(pedidoService.cancelarPedidoPendiente).not.toHaveBeenCalled();
  });

  it.each([
    ['sabado', '2026-08-29T15:00:00.000Z'],
    ['domingo', '2026-08-30T15:00:00.000Z'],
    ['lunes antes de las 12', '2026-08-31T14:59:00.000Z'],
  ])('no ejecuta la cancelacion automatica el %s', async (_, date) => {
    jest.useFakeTimers().setSystemTime(new Date(date));
    const { service, pedidoRepo } = createService();

    await service.scheduledRun();

    expect(pedidoRepo.find).not.toHaveBeenCalled();
  });

  it('reanuda la cancelacion automatica el lunes a las 12', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T15:00:00.000Z'));
    const { service, pedidoRepo } = createService();

    await service.scheduledRun();

    expect(pedidoRepo.find).toHaveBeenCalledTimes(2);
  });
});
