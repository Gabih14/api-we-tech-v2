import { CobrosService } from './cobros.service';

describe('CobrosService tieneCobroFacturaDelPedido', () => {
  const creado = new Date('2026-08-04T12:00:00Z');
  const pedido = {
    external_id: 'pedido-original',
    cliente_cuit: '20123456789',
    cliente_mail: 'cliente@test.com',
    total: 1500,
    creado,
  };
  const comprobanteRepo = {
    findOne: jest.fn(),
  };
  const cobroFacturaRepo = {
    findOne: jest.fn(),
  };
  let service: CobrosService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CobrosService(
      {} as any,
      comprobanteRepo as any,
      {} as any,
      {} as any,
      cobroFacturaRepo as any,
    );
    cobroFacturaRepo.findOne.mockResolvedValue({ cobro: 'COBRO-1' });
  });

  it('acepta un comprobante nuevo vinculado al mismo pedido', async () => {
    comprobanteRepo.findOne.mockResolvedValue({
      cliente: pedido.cliente_cuit,
      total: pedido.total,
      anulado: false,
      observaciones_int: 'PEDIDO_WEB:pedido-original',
    });

    await expect(
      service.tieneCobroFacturaDelPedido('FX', 'X 00001 00000001', pedido),
    ).resolves.toBe(true);
  });

  it('rechaza un numero reutilizado vinculado a otro pedido', async () => {
    comprobanteRepo.findOne.mockResolvedValue({
      cliente: pedido.cliente_cuit,
      total: pedido.total,
      anulado: false,
      observaciones_int: 'PEDIDO_WEB:otro-pedido',
    });

    await expect(
      service.tieneCobroFacturaDelPedido('FX', 'X 00001 00000001', pedido),
    ).resolves.toBe(false);
    expect(cobroFacturaRepo.findOne).not.toHaveBeenCalled();
  });

  it('acepta un comprobante anterior que coincide con los datos del pedido', async () => {
    comprobanteRepo.findOne.mockResolvedValue({
      cliente: pedido.cliente_cuit,
      email: pedido.cliente_mail,
      total: pedido.total,
      fecha: new Date(creado.getTime() + 5_000),
      anulado: false,
      observaciones_int: null,
    });

    await expect(
      service.tieneCobroFacturaDelPedido('FX', 'X 00001 00000001', pedido),
    ).resolves.toBe(true);
  });

  it('rechaza un comprobante anterior reutilizado mucho despues', async () => {
    comprobanteRepo.findOne.mockResolvedValue({
      cliente: pedido.cliente_cuit,
      email: pedido.cliente_mail,
      total: pedido.total,
      fecha: new Date(creado.getTime() + 24 * 60 * 60_000),
      anulado: false,
      observaciones_int: null,
    });

    await expect(
      service.tieneCobroFacturaDelPedido('FX', 'X 00001 00000001', pedido),
    ).resolves.toBe(false);
    expect(cobroFacturaRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('CobrosService cobrarFactura', () => {
  it('valida las cuentas contra la tabla tsr_cuenta de la nueva estructura', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      transaction: jest.fn(async (callback) => callback({ query })),
    };
    const service = new CobrosService(
      dataSource as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.cobrarFactura('FX', 'X 00001 00000001', {
        modalidad: 'CUENTA',
        medioId: 'BANCOGALICIA',
      }),
    ).rejects.toThrow('no existe en tsr_cuenta');

    expect(query).toHaveBeenCalledWith(
      'SELECT 1 FROM tsr_cuenta WHERE id = ? LIMIT 1',
      ['BANCOGALICIA'],
    );
  });
});
