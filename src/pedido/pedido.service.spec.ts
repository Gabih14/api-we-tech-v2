import { BadRequestException, Logger } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'pedido-test-id'),
}));

describe('PedidoService recalculo de importes', () => {
  const createRepo = {
    create: jest.fn((pedido) => pedido),
    save: jest.fn(async (pedido) => ({ ...pedido, id: pedido.id ?? 1 })),
  };
  const stkItemRepo = {
    findOne: jest.fn(),
  };
  const stockService = {
    reservarStock: jest.fn(async () => undefined),
    liberarStock: jest.fn(async () => undefined),
  };
  const vtaComprobanteService = {
    crearDesdePedido: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'SECRETARIA_EMAIL') {
        return 'secretaria@test.com';
      }
      return undefined;
    }),
  };
  const mailerService = {
    enviarMail: jest.fn(),
    enviarCorreo: jest.fn(async () => undefined),
  };
  const whatsappService = {
    formatearMensajeTransferenciaPendiente: jest.fn(() => 'msg'),
    formatearMensajePedido: jest.fn(() => 'msg'),
    formatearMensajeParaDelivery: jest.fn(() => 'msg'),
  };
  const telegramService = {
    enviarMensaje: jest.fn(async () => undefined),
  };
  const cobrosService = {};
  const cuponService = {
    validarUsoCupon: jest.fn(async () => undefined),
    resolverPorcentajePorModalidad: jest.fn(),
  };

  let service: PedidoService;
  let warnSpy: jest.SpyInstance;

  const dtoBase = (
    overrides: Partial<CreatePedidoDto> = {},
  ): CreatePedidoDto => ({
    cliente_nombre: 'Cliente Test',
    cliente_cuit: '20123456789',
    cliente_mail: 'cliente@test.com',
    email: 'cliente@test.com',
    telefono: '1111111111',
    calle: 'Calle',
    ciudad: 'Ciudad',
    region: 'Region',
    pais: 'AR',
    codigo_postal: '1000',
    mobile: '1111111111',
    total: 0,
    productos: [],
    billing_address: {
      street: 'Calle',
      number: '123',
      city: 'Ciudad',
      region: 'Region',
      country: 'AR',
      postal_code: '1000',
    },
    tipo_envio: 'pickup',
    costo_envio: 0,
    observaciones: '',
    metodo_pago: 'online',
    ...overrides,
  });

  const itemConPrecio = (
    id: string,
    precioVta: string,
    moneda = 'PES',
    cotizacion = '1',
    grupo: string | null = null,
    descripcion = `Descripcion ${id}`,
  ) => ({
    id,
    descripcion,
    grupo,
    stkPrecios: [
      {
        lista: 'MINORISTA',
        precioVta,
        moneda: {
          id: moneda,
          cotizacion,
        },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    service = new PedidoService(
      createRepo as any,
      stkItemRepo as any,
      stockService as any,
      vtaComprobanteService as any,
      configService as any,
      mailerService as any,
      whatsappService as any,
      telegramService as any,
      cobrosService as any,
      cuponService as any,
    );
    jest
      .spyOn(service, 'generarIntencionDePago')
      .mockResolvedValue('https://nave.test/checkout');
  });

  it('recalcula precio en pesos y redondea normal al peso', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-1', '10.01'));

    const dto = dtoBase({
      total: 10,
      productos: [
        {
          nombre: 'ITEM-1',
          cantidad: 1,
          precio_unitario: 10,
          subtotal: 10,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.total).toBe(10);
    expect(pedido.productos[0].precio_unitario).toBe(10);
    expect(pedido.productos[0].subtotal).toBe(10);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 10,
        productos: [
          expect.objectContaining({
            precio_unitario: 10,
            subtotal: 10,
          }),
        ],
      }),
    );
  });

  it('cotiza dolares solo para moneda DOL y redondea normal', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio('ITEM-USD', '10.01', 'DOL', '1000.25'),
    );

    const dto = dtoBase({
      total: 10013,
      productos: [
        {
          nombre: 'ITEM-USD',
          cantidad: 1,
          precio_unitario: 10013,
          subtotal: 10013,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(10013);
    expect(pedido.total).toBe(10013);
  });

  it('redondea .49 hacia abajo y .50 hacia arriba', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(itemConPrecio('ITEM-BAJA', '10.49'))
      .mockResolvedValueOnce(itemConPrecio('ITEM-SUBE', '10.50'));

    const dto = dtoBase({
      total: 21,
      productos: [
        {
          nombre: 'ITEM-BAJA',
          cantidad: 1,
          precio_unitario: 10,
          subtotal: 10,
        },
        {
          nombre: 'ITEM-SUBE',
          cantidad: 1,
          precio_unitario: 11,
          subtotal: 11,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(10);
    expect(pedido.productos[1].precio_unitario).toBe(11);
    expect(pedido.total).toBe(21);
  });

  it('mantiene descuento de filamento si es mayor que el cupon y excluye envio de la base', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio('ITEM-2', '101', 'PES', '1', 'FILAMENTOS'),
    );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 10,
    });

    const dto = dtoBase({
      codigo_cupon: 'CUPON10',
      descuento_cupon: 0,
      costo_envio: 50,
      total: 136,
      productos: [
        {
          nombre: 'ITEM-2',
          cantidad: 1,
          precio_unitario: 86,
          subtotal: 86,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(cuponService.resolverPorcentajePorModalidad).toHaveBeenCalledWith(
      'CUPON10',
      'TARJETA',
    );
    expect(pedido.productos[0].precio_unitario).toBe(86);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(15);
    expect(pedido.descuento_cupon).toBeUndefined();
    expect(pedido.total).toBe(136);
  });

  it('aplica solo el cupon cuando supera al descuento automatico de producto', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'HB-PLA-1KG-AMAR',
        '19411',
        'PES',
        '1',
        'FILAMENTOS',
        'Filamento PLA 1kg amarillo',
      ),
    );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
    });
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FX',
      comprobante: '0002',
    });

    const productos = Array.from({ length: 6 }, () => ({
      nombre: 'HB-PLA-1KG-AMAR',
      cantidad: 1,
      precio_unitario: 15529,
      subtotal: 19411,
      ajuste_porcentaje: 20,
    }));

    const dto = dtoBase({
      metodo_pago: 'transfer',
      codigo_cupon: 'TEST',
      descuento_cupon: 23292,
      total: 93174,
      productos,
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos).toHaveLength(6);
    expect(pedido.productos[0].precio_unitario).toBe(15529);
    expect(pedido.productos[0].subtotal).toBe(15529);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.descuento_cupon).toBe(23292);
    expect(pedido.total).toBe(93174);
  });

  it('acepta pedidos sin precios y calcula descuento elegible desde DB', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        '3N-PLA-1KG-NEGR',
        '100',
        'PES',
        '1',
        'FILAMENTOS',
        'Filamento PLA 1kg negro',
      ),
    );

    const dto = dtoBase({
      total: undefined,
      productos: [
        {
          nombre: '3N-PLA-1KG-NEGR',
          cantidad: 10,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(80);
    expect(pedido.productos[0].subtotal).toBe(800);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.total).toBe(800);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 800,
        productos: [
          expect.objectContaining({
            precio_unitario: 80,
            subtotal: 800,
            ajuste_porcentaje: 20,
          }),
        ],
      }),
    );
  });

  it('redondea el descuento de cupon normal al peso', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-2B', '101'));
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 10,
    });

    const dto = dtoBase({
      codigo_cupon: 'CUPON10',
      descuento_cupon: 10,
      total: 91,
      productos: [
        {
          nombre: 'ITEM-2B',
          cantidad: 1,
          precio_unitario: 91,
          subtotal: 101,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(10);
    expect(pedido.total).toBe(91);
  });

  it('usa porcentaje de transferencia para pedidos transfer', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-3', '100'));
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 5,
    });
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FX',
      comprobante: '0001',
    });

    const dto = dtoBase({
      metodo_pago: 'transfer',
      codigo_cupon: 'TRANSFER5',
      descuento_cupon: 5,
      total: 95,
      productos: [
        {
          nombre: 'ITEM-3',
          cantidad: 1,
          precio_unitario: 95,
          subtotal: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(cuponService.resolverPorcentajePorModalidad).toHaveBeenCalledWith(
      'TRANSFER5',
      'CUENTA',
    );
    expect(pedido.total).toBe(95);
  });

  it('calcula el subtotal neto como el frontend desde subtotal bruto y descuento', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        '3N-PLA-1KG-AMAR',
        '21764',
        'PES',
        '1',
        'FILAMENTOS',
        'Filamento PLA 1kg amarillo',
      ),
    );

    const dto = dtoBase({
      metodo_pago: 'transfer',
      total: 90321,
      productos: [
        {
          nombre: '3N-PLA-1KG-AMAR',
          cantidad: 5,
          precio_unitario: 18064,
          subtotal: 108820,
          ajuste_porcentaje: 17,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(18064);
    expect(pedido.productos[0].subtotal).toBe(90321);
    expect(pedido.total).toBe(90321);
  });

  it('rechaza diferencias y no reserva stock', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-4', '100'));

    const dto = dtoBase({
      total: 90,
      productos: [
        {
          nombre: 'ITEM-4',
          cantidad: 1,
          precio_unitario: 90,
          subtotal: 90,
        },
      ],
    });

    const crearPedido = service.crear(dto);

    await expect(crearPedido).rejects.toThrow(BadRequestException);
    await expect(crearPedido).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ERR_ORDER_TOTAL_MISMATCH',
        expected: expect.objectContaining({ total: 100 }),
        productos: [
          expect.objectContaining({
            nombre: 'ITEM-4',
            expected: {
              precio_unitario: 100,
              subtotal: 100,
            },
          }),
        ],
      }),
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ERR_ORDER_TOTAL_MISMATCH',
        expected: expect.objectContaining({ total: 100 }),
        received: expect.objectContaining({ total: 90 }),
        productos: [
          expect.objectContaining({
            nombre: 'ITEM-4',
            expected: expect.objectContaining({
              precio_unitario: 100,
              subtotal: 100,
            }),
            received: expect.objectContaining({
              precio_unitario: 90,
              subtotal: 90,
            }),
          }),
        ],
      }),
      'Los importes recibidos no coinciden con el calculo del servidor.',
    );
    expect(stockService.reservarStock).not.toHaveBeenCalled();
  });
});
