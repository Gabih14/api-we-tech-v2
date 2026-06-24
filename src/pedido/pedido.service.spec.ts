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

  it('arma cliente_ubicacion priorizando la direccion resuelta por Maps', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-1', '10.01'));

    const dto = dtoBase({
      calle: 'Direccion Parcial',
      ciudad: 'Ciudad Real',
      region: 'Provincia Real',
      pais: 'AR',
      codigo_postal: '2000',
      direccion: 'Direccion Real 456, M2000 Ciudad Real, Argentina',
      billing_address: {
        street: 'Billing Street',
        number: '999',
        city: 'Billing City',
        region: 'Billing Region',
        country: 'BR',
        postal_code: '9999',
      },
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

    expect(pedido.cliente_ubicacion).toBe(
      'Direccion Real 456, M2000 Ciudad Real, Argentina',
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

  it('mantiene descuento de filamento en transferencia si es mayor que el cupon y excluye envio de la base', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio('ITEM-2', '101', 'PES', '1', 'FILAMENTOS'),
    );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 10,
    });
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FX',
      comprobante: '0003',
    });

    const dto = dtoBase({
      metodo_pago: 'transfer',
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
      'CUENTA',
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

  it('acepta pedidos online sin precios y calcula importes desde DB sin descuento diferencial', async () => {
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

    expect(pedido.productos[0].precio_unitario).toBe(100);
    expect(pedido.productos[0].subtotal).toBe(1000);
    expect(pedido.productos[0].ajuste_porcentaje).toBeNull();
    expect(pedido.total).toBe(1000);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1000,
        productos: [
          expect.objectContaining({
            precio_unitario: 100,
            subtotal: 1000,
          }),
        ],
      }),
    );
  });

  it('no aplica descuento base de filamento para pagos online', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'GL-PLA-1KG-VAIN',
        '21175',
        'PES',
        '1',
        'FILAMENTOS',
        'Filamento PLA 1kg vainilla',
      ),
    );

    const dto = dtoBase({
      metodo_pago: 'online',
      total: 25174,
      costo_envio: 3999,
      productos: [
        {
          nombre: 'GL-PLA-1KG-VAIN',
          cantidad: 1,
          precio_unitario: 21175,
          subtotal: 21175,
          ajuste_porcentaje: 0,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(21175);
    expect(pedido.productos[0].ajuste_porcentaje).toBeNull();
    expect(pedido.costo_envio).toBe(3999);
    expect(pedido.total).toBe(25174);
  });

  it('no aplica descuento base a filamentos elegibles en online con menos de 5 unidades', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-SILK-1KG-DORA',
          '32352',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento Silk 1kg dorado',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'HB-PLA-1KG-COBA',
          '19411',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg cobre',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'HB-PLA-1KG-PIMA',
          '19411',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg piel madera',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'HB-PLA-1KG-MARR',
          '19411',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg marron',
        ),
      );

    const dto = dtoBase({
      metodo_pago: 'online',
      total: 90585,
      productos: [
        {
          nombre: 'G3-SILK-1KG-DORA',
          cantidad: 1,
          precio_unitario: 32352,
          subtotal: 32352,
          ajuste_porcentaje: 0,
        },
        {
          nombre: 'HB-PLA-1KG-COBA',
          cantidad: 1,
          precio_unitario: 19411,
          subtotal: 19411,
          ajuste_porcentaje: 0,
        },
        {
          nombre: 'HB-PLA-1KG-PIMA',
          cantidad: 1,
          precio_unitario: 19411,
          subtotal: 19411,
          ajuste_porcentaje: 0,
        },
        {
          nombre: 'HB-PLA-1KG-MARR',
          cantidad: 1,
          precio_unitario: 19411,
          subtotal: 19411,
          ajuste_porcentaje: 0,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[1].precio_unitario).toBe(19411);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
    expect(pedido.productos[2].precio_unitario).toBe(19411);
    expect(pedido.productos[2].ajuste_porcentaje).toBeNull();
    expect(pedido.productos[3].precio_unitario).toBe(19411);
    expect(pedido.productos[3].ajuste_porcentaje).toBeNull();
    expect(pedido.total).toBe(90585);
  });

  it('no aplica descuento diferencial a filamentos elegibles en online aunque llegue a 5 unidades', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA1-1KG-NEGR',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg negro',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA2-1KG-AMFL',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg amarillo fluor',
        ),
      );

    const dto = dtoBase({
      metodo_pago: 'online',
      total: 500,
      productos: [
        {
          nombre: 'G3-PLA1-1KG-NEGR',
          cantidad: 3,
          precio_unitario: 100,
          subtotal: 300,
          ajuste_porcentaje: 0,
        },
        {
          nombre: 'G3-PLA2-1KG-AMFL',
          cantidad: 2,
          precio_unitario: 100,
          subtotal: 200,
          ajuste_porcentaje: 0,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(100);
    expect(pedido.productos[0].subtotal).toBe(300);
    expect(pedido.productos[0].ajuste_porcentaje).toBeNull();
    expect(pedido.productos[1].precio_unitario).toBe(100);
    expect(pedido.productos[1].subtotal).toBe(200);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
    expect(pedido.total).toBe(500);
  });

  it('deja envio gratis para shipping desde 10 kg aunque reciba costo de envio', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-10KG',
        '100',
        'PES',
        '1',
        null,
        'Producto 1kg',
      ),
    );

    const dto = dtoBase({
      tipo_envio: 'shipping',
      costo_envio: 250,
      total: 1000,
      productos: [
        {
          nombre: 'ITEM-10KG',
          cantidad: 10,
          precio_unitario: 100,
          subtotal: 1000,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(0);
    expect(pedido.total).toBe(1000);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 0,
        total: 1000,
      }),
    );
  });

  it('conserva costo de envio para shipping con menos de 10 kg', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-9KG',
        '100',
        'PES',
        '1',
        null,
        'Producto 1kg',
      ),
    );

    const dto = dtoBase({
      tipo_envio: 'shipping',
      costo_envio: 250,
      total: 1150,
      productos: [
        {
          nombre: 'ITEM-9KG',
          cantidad: 9,
          precio_unitario: 100,
          subtotal: 900,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(250);
    expect(pedido.total).toBe(1150);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 250,
        total: 1150,
      }),
    );
  });

  it('usa el producto ENV como costo de envio sin duplicarlo en el total', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'GL-PLA-1KG-VAIN',
          '21175',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg vainilla',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'ENV-07K-GM-DELIVERY',
          '3999',
          'PES',
          '1',
          null,
          'Envio delivery',
        ),
      );

    const dto = dtoBase({
      tipo_envio: 'shipping',
      costo_envio: 3999,
      total: 25174,
      productos: [
        {
          nombre: 'GL-PLA-1KG-VAIN',
          cantidad: 1,
          precio_unitario: 21175,
          subtotal: 21175,
        },
        {
          nombre: 'ENV-07K-GM-DELIVERY',
          cantidad: 1,
          precio_unitario: 3999,
          subtotal: 3999,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(3999);
    expect(pedido.total).toBe(25174);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 3999,
        total: 25174,
      }),
    );
  });

  it('no aplica cupon al producto ENV de envio', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'ITEM-CUPON',
          '100',
          'PES',
          '1',
          null,
          'Producto con cupon',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'ENV-09K-GM-DELIVERY',
          '50',
          'PES',
          '1',
          null,
          'Envio delivery',
        ),
      );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
    });

    const dto = dtoBase({
      tipo_envio: 'shipping',
      metodo_pago: 'online',
      codigo_cupon: 'CUPON20',
      descuento_cupon: 20,
      costo_envio: 50,
      total: 130,
      productos: [
        {
          nombre: 'ITEM-CUPON',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
        {
          nombre: 'ENV-09K-GM-DELIVERY',
          cantidad: 1,
          precio_unitario: 50,
          subtotal: 50,
          ajuste_porcentaje: 0,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(20);
    expect(pedido.costo_envio).toBe(50);
    expect(pedido.total).toBe(130);
    expect(pedido.productos[0].precio_unitario).toBe(80);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.productos[1].precio_unitario).toBe(50);
    expect(pedido.productos[1].subtotal).toBe(50);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
  });

  it('no cuenta el producto ENV para envio gratis por peso', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'ITEM-9KG',
          '100',
          'PES',
          '1',
          null,
          'Producto 1kg',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'ENV-07K-GM-DELIVERY',
          '3999',
          'PES',
          '1',
          null,
          'Envio 7kg delivery',
        ),
      );

    const dto = dtoBase({
      tipo_envio: 'shipping',
      costo_envio: 3999,
      total: 4899,
      productos: [
        {
          nombre: 'ITEM-9KG',
          cantidad: 9,
          precio_unitario: 100,
          subtotal: 900,
        },
        {
          nombre: 'ENV-07K-GM-DELIVERY',
          cantidad: 1,
          precio_unitario: 3999,
          subtotal: 3999,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(3999);
    expect(pedido.total).toBe(4899);
  });

  it('no aplica envio gratis por peso para pickup', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-PICKUP-10KG',
        '100',
        'PES',
        '1',
        null,
        'Producto 1kg',
      ),
    );

    const dto = dtoBase({
      tipo_envio: 'pickup',
      costo_envio: 250,
      total: 1250,
      productos: [
        {
          nombre: 'ITEM-PICKUP-10KG',
          cantidad: 10,
          precio_unitario: 100,
          subtotal: 1000,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(250);
    expect(pedido.total).toBe(1250);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 250,
        total: 1250,
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

  it('combina colores de la misma marca elegible para calcular el descuento por cantidad en transferencias', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA1-1KG-NEGR',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg negro',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA2-1KG-AMFL',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg amarillo fluor',
        ),
      );

    const dto = dtoBase({
      metodo_pago: 'transfer',
      total: undefined,
      productos: [
        {
          nombre: 'G3-PLA1-1KG-NEGR',
          cantidad: 3,
        },
        {
          nombre: 'G3-PLA2-1KG-AMFL',
          cantidad: 2,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(83);
    expect(pedido.productos[0].subtotal).toBe(249);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(17);
    expect(pedido.productos[1].precio_unitario).toBe(83);
    expect(pedido.productos[1].subtotal).toBe(166);
    expect(pedido.productos[1].ajuste_porcentaje).toBe(17);
    expect(pedido.total).toBe(415);
  });

  it('combina marcas distintas dentro de la lista de descuento diferencial en transferencias', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA1-1KG-NEGR',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg negro',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'HB-PLA-1KG-BLAN',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg blanco',
        ),
      );

    const dto = dtoBase({
      metodo_pago: 'transfer',
      total: undefined,
      productos: [
        {
          nombre: 'G3-PLA1-1KG-NEGR',
          cantidad: 4,
        },
        {
          nombre: 'HB-PLA-1KG-BLAN',
          cantidad: 1,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(83);
    expect(pedido.productos[0].subtotal).toBe(332);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(17);
    expect(pedido.productos[1].precio_unitario).toBe(83);
    expect(pedido.productos[1].subtotal).toBe(83);
    expect(pedido.productos[1].ajuste_porcentaje).toBe(17);
    expect(pedido.total).toBe(415);
  });

  it('no suma productos de peso distinto al grupo diferencial de 1kg', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA1-1KG-NEGR',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg negro',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'G3-PLA1-500G-BLAN',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 500g blanco',
        ),
      );
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FX',
      comprobante: '0004',
    });

    const dto = dtoBase({
      metodo_pago: 'transfer',
      total: undefined,
      productos: [
        {
          nombre: 'G3-PLA1-1KG-NEGR',
          cantidad: 4,
        },
        {
          nombre: 'G3-PLA1-500G-BLAN',
          cantidad: 1,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(85);
    expect(pedido.productos[0].subtotal).toBe(340);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(15);
    expect(pedido.productos[1].precio_unitario).toBe(85);
    expect(pedido.productos[1].subtotal).toBe(85);
    expect(pedido.productos[1].ajuste_porcentaje).toBe(15);
    expect(pedido.total).toBe(425);
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
    expect(mailerService.enviarCorreo).toHaveBeenCalledWith(
      'virtual.hache@gmail.com',
      'Alerta WeTech: importes no coinciden',
      expect.stringContaining('ERR_ORDER_TOTAL_MISMATCH'),
    );
    expect(mailerService.enviarCorreo).toHaveBeenCalledWith(
      'virtual.hache@gmail.com',
      'Alerta WeTech: importes no coinciden',
      expect.stringContaining('&quot;total&quot;: 90'),
    );
    expect(stockService.reservarStock).not.toHaveBeenCalled();
  });
});
