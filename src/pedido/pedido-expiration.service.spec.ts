jest.mock('./pedido.service', () => ({
  PedidoService: class PedidoService {},
}));

import { PedidoExpirationService } from './pedido-expiration.service';

describe('PedidoExpirationService', () => {
  const originalEnabled = process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;
  const originalOpenHour = process.env.PEDIDO_EXPIRATION_OPEN_HOUR;
  const originalCloseHour = process.env.PEDIDO_EXPIRATION_CLOSE_HOUR;
  const originalMondayOpenHour =
    process.env.PEDIDO_EXPIRATION_MONDAY_OPEN_HOUR;

  afterEach(() => {
    jest.useRealTimers();

    if (originalEnabled === undefined) {
      delete process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED;
    } else {
      process.env.PEDIDO_TRANSFER_APPROVAL_ENABLED = originalEnabled;
    }

    if (originalOpenHour === undefined) {
      delete process.env.PEDIDO_EXPIRATION_OPEN_HOUR;
    } else {
      process.env.PEDIDO_EXPIRATION_OPEN_HOUR = originalOpenHour;
    }

    if (originalCloseHour === undefined) {
      delete process.env.PEDIDO_EXPIRATION_CLOSE_HOUR;
    } else {
      process.env.PEDIDO_EXPIRATION_CLOSE_HOUR = originalCloseHour;
    }

    if (originalMondayOpenHour === undefined) {
      delete process.env.PEDIDO_EXPIRATION_MONDAY_OPEN_HOUR;
    } else {
      process.env.PEDIDO_EXPIRATION_MONDAY_OPEN_HOUR =
        originalMondayOpenHour;
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
      creado: new Date(Date.now() - 31 * 60_000),
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
      creado: new Date(Date.now() - 2881 * 60_000),
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

  it('no ejecuta la cancelacion automatica despues del cierre diario', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T22:30:00.000Z'));
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

  it('cuenta el TTL solo dentro del horario habil', async () => {
    process.env.PEDIDO_EXPIRATION_OPEN_HOUR = '9';
    process.env.PEDIDO_EXPIRATION_CLOSE_HOUR = '19';
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T15:59:00.000Z'));
    const pedido = {
      external_id: 'pedido-online-no-expirado',
      metodo_pago: 'online',
      creado: new Date('2026-09-01T22:30:00.000Z'),
    };
    const { service, pedidoRepo, pedidoService } = createService();
    pedidoRepo.find.mockResolvedValueOnce([pedido]).mockResolvedValueOnce([]);

    await expect(service.run(240)).resolves.toMatchObject({ expirados: 0 });

    expect(pedidoService.cancelarPedidoPendiente).not.toHaveBeenCalled();
  });

  it('expira un pedido nocturno cuando consume sus horas habiles al dia siguiente', async () => {
    process.env.PEDIDO_EXPIRATION_OPEN_HOUR = '9';
    process.env.PEDIDO_EXPIRATION_CLOSE_HOUR = '19';
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T16:00:00.000Z'));
    const pedido = {
      external_id: 'pedido-online-expirado-dia-siguiente',
      metodo_pago: 'online',
      creado: new Date('2026-09-01T22:30:00.000Z'),
    };
    const { service, pedidoRepo, pedidoService } = createService();
    pedidoRepo.find.mockResolvedValueOnce([pedido]).mockResolvedValueOnce([]);

    await expect(service.run(240)).resolves.toMatchObject({ expirados: 1 });

    expect(pedidoService.cancelarPedidoPendiente).toHaveBeenCalledWith(
      pedido.external_id,
      'Pedido cancelado automaticamente por expiracion',
    );
  });
});
