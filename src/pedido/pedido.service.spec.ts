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
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(async (callback) =>
        callback({ getRepository: () => createRepo }),
      ),
    },
  };
  const stkItemRepo = {
    findOne: jest.fn(),
  };
  // Atributos (Marca+Material) por ítem para la elegibilidad de descuento por cantidad.
  const ATRIBUTOS_POR_ITEM: Record<
    string,
    { marca: string; material: string }
  > = {
    '3N-PLA-1KG-AMAR': { marca: '3n3', material: 'PLA' },
    'EG-PLA-1KG-AZOS': { marca: 'Elegoo', material: 'PLA' },
    'FM-PLA-1KG-GRMA': { marca: 'Fremover', material: 'High Speed PLA' },
    'FM-PLA-1KG-AMAR': { marca: 'Fremover', material: 'High Speed PLA' },
    'G3-PLA1-1KG-NEGR': { marca: 'Grilon3', material: 'PLA' },
    'G3-PLA2-1KG-AMFL': { marca: 'Grilon3', material: 'PLA' },
    'HB-PLA-1KG-BLAN': { marca: 'Hellbot', material: 'PLA' },
  };
  const stkAtributoNodoRepo = {
    createQueryBuilder: jest.fn(() => {
      let arboles: string[] = [];
      const qb: any = {
        innerJoin: () => qb,
        select: () => qb,
        addSelect: () => qb,
        where: (_condition: string, params: any) => {
          arboles = params?.arboles ?? [];
          return qb;
        },
        andWhere: () => qb,
        getRawMany: async () =>
          arboles.flatMap((arbol) => {
            const attr = ATRIBUTOS_POR_ITEM[arbol];
            return attr
              ? [
                  { arbol, clase: 'Marca', valor: attr.marca },
                  { arbol, clase: 'Material', valor: attr.material },
                ]
              : [];
          }),
      };
      return qb;
    }),
  };
  const stockService = {
    reservarStock: jest.fn(async () => 'DEPOSITO'),
    liberarStock: jest.fn(async () => undefined),
    confirmarStock: jest.fn(async () => 'DEPOSITO'),
    restaurarStockConfirmado: jest.fn(async () => undefined),
    confirmarStockLote: jest.fn(async (solicitudes) =>
      solicitudes.map((solicitud) => ({
        item: solicitud.item,
        cantidad: solicitud.cantidad,
        depositoReserva: solicitud.item.startsWith('ENV')
          ? 'ENV'
          : (solicitud.deposito ?? 'DEPOSITO'),
        salidas: [
          {
            deposito: solicitud.item.startsWith('ENV')
              ? 'ENV'
              : (solicitud.deposito ?? 'DEPOSITO'),
            cantidad: solicitud.cantidad,
          },
        ],
      })),
    ),
    restaurarStockConfirmadoLote: jest.fn(async () => undefined),
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
  const cobrosService = {
    cobrarFactura: jest.fn(async () => undefined),
    tieneCobroFacturaDelPedido: jest.fn(async () => true),
  };
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
    preciosExtra: Array<{ lista: string; precioVta: string }> = [],
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
      ...preciosExtra.map((precio) => ({
        lista: precio.lista,
        precioVta: precio.precioVta,
        moneda: {
          id: moneda,
          cotizacion,
        },
      })),
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    service = new PedidoService(
      createRepo as any,
      stkItemRepo as any,
      stkAtributoNodoRepo as any,
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

  it('no guarda datos de factura cuando no se requiere factura', async () => {
    stkItemRepo.findOne.mockResolvedValue(itemConPrecio('ITEM-SIN-FAC', '100'));

    const dto = dtoBase({
      total: 100,
      productos: [
        {
          nombre: 'ITEM-SIN-FAC',
          cantidad: 1,
          precio_unitario: 100,
          subtotal: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.total).toBe(100);
    expect(pedido.factura_tipo).toBeNull();
    expect(pedido.factura_iva_porcentaje).toBeNull();
    expect(pedido.factura_iva_importe).toBeNull();
  });

  it('suma 21% al total y guarda factura A', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-FAC-A',
        '100',
        'PES',
        '1',
        null,
        'Descripcion ITEM-FAC-A',
        [{ lista: 'MINORISTA CON IVA', precioVta: '100' }],
      ),
    );

    const dto = dtoBase({
      factura_tipo: 'A',
      total: 121,
      productos: [
        {
          nombre: 'ITEM-FAC-A',
          cantidad: 1,
          precio_unitario: 121,
          subtotal: 121,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.total).toBe(121);
    expect(pedido.factura_tipo).toBe('A');
    expect(pedido.factura_iva_porcentaje).toBe(21);
    expect(pedido.factura_iva_importe).toBe(21);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 121,
      }),
    );
  });

  it('suma 21% al total y guarda factura B', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-FAC-B',
        '100',
        'PES',
        '1',
        null,
        'Descripcion ITEM-FAC-B',
        [{ lista: 'MINORISTA CON IVA', precioVta: '100' }],
      ),
    );

    const dto = dtoBase({
      factura_tipo: 'B',
      total: 121,
      productos: [
        {
          nombre: 'ITEM-FAC-B',
          cantidad: 1,
          precio_unitario: 121,
          subtotal: 121,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.total).toBe(121);
    expect(pedido.factura_tipo).toBe('B');
    expect(pedido.factura_iva_porcentaje).toBe(21);
    expect(pedido.factura_iva_importe).toBe(21);
  });

  it('calcula el IVA de cabecera sobre productos y envio', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'ITEM-FAC-1',
          '100',
          'PES',
          '1',
          null,
          'Descripcion ITEM-FAC-1',
          [{ lista: 'MINORISTA CON IVA', precioVta: '100' }],
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'ITEM-FAC-2',
          '100',
          'PES',
          '1',
          null,
          'Descripcion ITEM-FAC-2',
          [{ lista: 'MINORISTA CON IVA', precioVta: '100' }],
        ),
      );

    const dto = dtoBase({
      factura_tipo: 'A',
      tipo_envio: 'shipping',
      costo_envio: 100,
      total: 363,
      productos: [
        {
          nombre: 'ITEM-FAC-1',
          cantidad: 1,
          precio_unitario: 121,
          subtotal: 121,
        },
        {
          nombre: 'ITEM-FAC-2',
          cantidad: 1,
          precio_unitario: 121,
          subtotal: 121,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.total).toBe(363);
    expect(pedido.factura_iva_importe).toBe(63);
    expect(service.generarIntencionDePago).toHaveBeenCalledWith(
      expect.objectContaining({
        costo_envio: 100,
        total: 363,
      }),
    );
  });

  it('acepta subtotal bruto con IVA cuando factura y ajuste_porcentaje vienen del frontend', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        '3X-PLAF-1KG-VEMA',
        '28822',
        'PES',
        '1',
        'FILAMENTOS',
        'Descripcion 3X-PLAF-1KG-VEMA',
        [{ lista: 'MINORISTA CON IVA', precioVta: '28822' }],
      ),
    );
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FB',
      comprobante: 'B 00001 00000001',
    });

    const dto = dtoBase({
      factura_tipo: 'B',
      metodo_pago: 'transfer',
      total: 29644,
      productos: [
        {
          nombre: '3X-PLAF-1KG-VEMA',
          cantidad: 1,
          precio_unitario: 29644,
          subtotal: 34875,
          ajuste_porcentaje: 15,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(24499);
    expect(pedido.productos[0].subtotal).toBe(24499);
    expect(pedido.factura_iva_importe).toBe(5144.79);
    expect(pedido.total).toBe(29643.79);
  });

  it('calcula factura como Nacional: IVA primero y descuento despues', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        '3N-PLA-1KG-BLAN',
        '21764',
        'PES',
        '1',
        'FILAMENTOS',
        'Descripcion 3N-PLA-1KG-BLAN',
        [{ lista: 'MINORISTA CON IVA', precioVta: '21764' }],
      ),
    );
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FA',
      comprobante: 'A 00005 00000001',
    });

    const dto = dtoBase({
      factura_tipo: 'A',
      metodo_pago: 'transfer',
      total: 22385,
      productos: [
        {
          nombre: '3N-PLA-1KG-BLAN',
          cantidad: 1,
          precio_unitario: 22385,
          subtotal: 26335.3,
          ajuste_porcentaje: 15,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos[0].precio_unitario).toBe(18500);
    expect(pedido.productos[0].subtotal).toBe(18500);
    expect(pedido.factura_iva_importe).toBe(3885);
    expect(pedido.total).toBe(22385);
  });

  it('calcula lineas de factura como Nacional con descuento 17%', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          '3N-PLA-1KG-AMAR',
          '23528',
          'PES',
          '1',
          'FILAMENTOS',
          'Descripcion 3N-PLA-1KG-AMAR',
          [{ lista: 'MINORISTA CON IVA', precioVta: '23528' }],
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'EG-PLA-1KG-AZOS',
          '32352',
          'PES',
          '1',
          'FILAMENTOS',
          'Descripcion EG-PLA-1KG-AZOS',
          [{ lista: 'MINORISTA CON IVA', precioVta: '32352' }],
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'FM-PLA-1KG-GRMA',
          '30587',
          'PES',
          '1',
          'FILAMENTOS',
          'Descripcion FM-PLA-1KG-GRMA',
          [{ lista: 'MINORISTA CON IVA', precioVta: '30587' }],
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'FM-PLA-1KG-AMAR',
          '30587',
          'PES',
          '1',
          'FILAMENTOS',
          'Descripcion FM-PLA-1KG-AMAR',
          [{ lista: 'MINORISTA CON IVA', precioVta: '30587' }],
        ),
      );
    vtaComprobanteService.crearDesdePedido.mockResolvedValue({
      tipo: 'FA',
      comprobante: 'A 00005 00000001',
    });

    const dto = dtoBase({
      factura_tipo: 'A',
      metodo_pago: 'transfer',
      total: 141187.64,
      productos: [
        {
          nombre: '3N-PLA-1KG-AMAR',
          cantidad: 2,
          precio_unitario: 23628.88,
          subtotal: 56937.76,
          ajuste_porcentaje: 17,
        },
        {
          nombre: 'EG-PLA-1KG-AZOS',
          cantidad: 1,
          precio_unitario: 32490.92,
          subtotal: 39145.92,
          ajuste_porcentaje: 17,
        },
        {
          nombre: 'FM-PLA-1KG-GRMA',
          cantidad: 1,
          precio_unitario: 30719.48,
          subtotal: 37010.84,
          ajuste_porcentaje: 17,
        },
        {
          nombre: 'FM-PLA-1KG-AMAR',
          cantidad: 1,
          precio_unitario: 30719.48,
          subtotal: 37010.84,
          ajuste_porcentaje: 17,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.productos.map((producto) => producto.subtotal)).toEqual([
      39056, 26852, 25388, 25388,
    ]);
    expect(pedido.factura_iva_importe).toBe(24503.64);
    expect(pedido.total).toBe(141187.64);
  });

  it('rechaza total sin IVA cuando se requiere factura', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'ITEM-FAC-MAL',
        '100',
        'PES',
        '1',
        null,
        'Descripcion ITEM-FAC-MAL',
        [{ lista: 'MINORISTA CON IVA', precioVta: '100' }],
      ),
    );

    const dto = dtoBase({
      factura_tipo: 'A',
      total: 100,
      productos: [
        {
          nombre: 'ITEM-FAC-MAL',
          cantidad: 1,
          precio_unitario: 121,
          subtotal: 121,
        },
      ],
    });

    const crearPedido = service.crear(dto);

    await expect(crearPedido).rejects.toThrow(BadRequestException);
    await expect(crearPedido).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ERR_ORDER_TOTAL_MISMATCH',
        expected: expect.objectContaining({ total: 121 }),
        received: expect.objectContaining({ total: 100 }),
      }),
    });
    expect(stockService.reservarStock).not.toHaveBeenCalled();
  });

  it('guarda por separado la direccion del cliente y la resuelta por Maps', async () => {
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
    expect(pedido.cliente_direccion).toBe(
      'Billing Street 999, Billing City, Billing Region, BR, 9999',
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
      itemConPrecio('ITEM-10KG', '100', 'PES', '1', null, 'Producto 1kg'),
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
      itemConPrecio('ITEM-9KG', '100', 'PES', '1', null, 'Producto 1kg'),
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

  it('aplica cupon de filamento solo a productos FILAMENTOS', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio(
          'FIL-1',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg negro',
        ),
      )
      .mockResolvedValueOnce(
        itemConPrecio('REP-1', '100', 'PES', '1', 'REPUESTOS'),
      );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: 'filamento',
    });

    const dto = dtoBase({
      codigo_cupon: 'FIL20',
      descuento_cupon: 20,
      total: 180,
      productos: [
        {
          nombre: 'FIL-1',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
        {
          nombre: 'REP-1',
          cantidad: 1,
          precio_unitario: 100,
          subtotal: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(20);
    expect(pedido.total).toBe(180);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
  });

  it('aplica cupon de filamento a productos FILAMENTO 3D del ERP', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio(
        'GSB-PLA-1KG-AZUL',
        '100',
        'PES',
        '1',
        'FILAMENTO 3D',
        'GST3D Black | PLA+ | 1kg | Basico Nacional | Azul',
      ),
    );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: 'filamento',
    });

    const dto = dtoBase({
      codigo_cupon: 'FIL20',
      descuento_cupon: 20,
      total: 80,
      productos: [
        {
          nombre: 'GSB-PLA-1KG-AZUL',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(20);
    expect(pedido.total).toBe(80);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
  });

  it('aplica cupon de impresora solo a productos IMPRESORAS', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio('IMP-1', '100', 'PES', '1', 'IMPRESORAS'),
      )
      .mockResolvedValueOnce(
        itemConPrecio('REP-1', '100', 'PES', '1', 'REPUESTOS'),
      );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: 'impresora',
    });

    const dto = dtoBase({
      codigo_cupon: 'IMP20',
      descuento_cupon: 20,
      total: 180,
      productos: [
        {
          nombre: 'IMP-1',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
        {
          nombre: 'REP-1',
          cantidad: 1,
          precio_unitario: 100,
          subtotal: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(20);
    expect(pedido.total).toBe(180);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
  });

  it('aplica cupon de repuesto a productos que no son filamentos ni impresoras', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio('REP-1', '100', 'PES', '1', 'REPUESTOS'),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'FIL-1',
          '100',
          'PES',
          '1',
          'FILAMENTOS',
          'Filamento PLA 1kg blanco',
        ),
      );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: 'repuesto',
    });

    const dto = dtoBase({
      codigo_cupon: 'REP20',
      descuento_cupon: 20,
      total: 180,
      productos: [
        {
          nombre: 'REP-1',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
        {
          nombre: 'FIL-1',
          cantidad: 1,
          precio_unitario: 100,
          subtotal: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(20);
    expect(pedido.total).toBe(180);
    expect(pedido.productos[0].ajuste_porcentaje).toBe(20);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
  });

  it('mantiene cupon general aplicado a todas las lineas no envio', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio('ITEM-1', '100', 'PES', '1', 'REPUESTOS'),
      )
      .mockResolvedValueOnce(
        itemConPrecio('ITEM-2', '100', 'PES', '1', 'IMPRESORAS'),
      );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: null,
    });

    const dto = dtoBase({
      codigo_cupon: 'GENERAL20',
      descuento_cupon: 40,
      total: 160,
      productos: [
        {
          nombre: 'ITEM-1',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
        {
          nombre: 'ITEM-2',
          cantidad: 1,
          precio_unitario: 80,
          subtotal: 80,
          ajuste_porcentaje: 20,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.descuento_cupon).toBe(40);
    expect(pedido.total).toBe(160);
  });

  it('rechaza cupon especifico cuando no hay productos compatibles', async () => {
    stkItemRepo.findOne.mockResolvedValue(
      itemConPrecio('REP-1', '100', 'PES', '1', 'REPUESTOS'),
    );
    cuponService.resolverPorcentajePorModalidad.mockResolvedValue({
      porcentajeAplicado: 20,
      categoriaAplicable: 'filamento',
    });

    const dto = dtoBase({
      codigo_cupon: 'FIL20',
      total: 100,
      productos: [
        {
          nombre: 'REP-1',
          cantidad: 1,
        },
      ],
    });

    await expect(service.crear(dto)).rejects.toThrow(
      'Cupon valido solo para productos de categoria filamento',
    );
    expect(stockService.reservarStock).not.toHaveBeenCalled();
  });

  it('bonifica el producto ENV al 100% cuando los productos llegan al peso de envio gratis', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio('ITEM-10KG', '100', 'PES', '1', null, 'Producto 1kg'),
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
      total: 1000,
      productos: [
        {
          nombre: 'ITEM-10KG',
          cantidad: 10,
          precio_unitario: 100,
          subtotal: 1000,
        },
        {
          nombre: 'ENV-07K-GM-DELIVERY',
          cantidad: 1,
          precio_unitario: 0,
          subtotal: 0,
          ajuste_porcentaje: 100,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(0);
    expect(pedido.total).toBe(1000);
    expect(pedido.productos[1].precio_unitario).toBe(0);
    expect(pedido.productos[1].subtotal).toBe(0);
    expect(pedido.productos[1].ajuste_porcentaje).toBe(100);
  });

  it('no usa los kilometros del producto ENV como peso para envio gratis', async () => {
    stkItemRepo.findOne
      .mockResolvedValueOnce(
        itemConPrecio('ITEM-1KG', '19999', 'PES', '1', null, 'Producto 1kg'),
      )
      .mockResolvedValueOnce(
        itemConPrecio(
          'ENV-11K-GM-DELIVERY',
          '5599',
          'PES',
          '1',
          null,
          'Envio 11km delivery',
        ),
      );

    const dto = dtoBase({
      tipo_envio: 'shipping',
      costo_envio: 5599,
      total: 25598,
      productos: [
        {
          nombre: 'ITEM-1KG',
          cantidad: 1,
          precio_unitario: 19999,
          subtotal: 19999,
        },
        {
          nombre: 'ENV-11K-GM-DELIVERY',
          cantidad: 1,
          precio_unitario: 5599,
          subtotal: 5599,
          ajuste_porcentaje: 0,
        },
      ],
    });

    const { pedido } = await service.crear(dto);

    expect(pedido.costo_envio).toBe(5599);
    expect(pedido.total).toBe(25598);
    expect(pedido.productos[1].precio_unitario).toBe(5599);
    expect(pedido.productos[1].subtotal).toBe(5599);
    expect(pedido.productos[1].ajuste_porcentaje).toBeNull();
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

  it('restaura el stock confirmado si falla la generacion del comprobante', async () => {
    const pedido = {
      id: 892,
      external_id: 'pedido-webhook',
      estado: 'PENDIENTE',
      metodo_pago: 'online',
      productos: [{ nombre: 'ITEM-1', cantidad: 1 }],
    };
    createRepo.findOne.mockResolvedValue(pedido);
    jest.spyOn(service, 'obtenerTokenDeNave').mockResolvedValue('token');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: { name: 'APPROVED' } }),
    } as Response);
    vtaComprobanteService.crearDesdePedido.mockRejectedValueOnce(
      new Error('fallo de comprobante'),
    );

    await expect(
      service.procesarNotificacionDeNave({
        payment_check_url: 'https://api.ranty.io/payment',
        external_payment_id: pedido.external_id,
      }),
    ).rejects.toThrow('fallo de comprobante');

    expect(stockService.confirmarStock).toHaveBeenCalledWith(
      'ITEM-1',
      1,
      undefined,
    );
    expect(stockService.restaurarStockConfirmado).toHaveBeenCalledWith(
      'ITEM-1',
      1,
      'DEPOSITO',
    );
    fetchSpy.mockRestore();
  });

  it('rechaza una URL de verificacion ajena antes de obtener el token', async () => {
    const tokenSpy = jest.spyOn(service, 'obtenerTokenDeNave');

    await expect(
      service.procesarNotificacionDeNave({
        payment_check_url: 'https://example.com/robar-token',
        external_payment_id: 'pedido-webhook',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tokenSpy).not.toHaveBeenCalled();
  });

  it('aprueba una transferencia confirmando el stock como un unico lote', async () => {
    const pedido = {
      id: 900,
      external_id: 'pedido-transferencia',
      estado: 'PENDIENTE',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000001',
      codigo_cupon: null,
      delivery_method: 'pickup',
      productos: [
        { nombre: 'ITEM-1', cantidad: 1, deposito_reserva: 'DEPOSITO' },
        { nombre: 'ITEM-2', cantidad: 2, deposito_reserva: 'DEPOSITO' },
      ],
    };
    createRepo.findOne.mockResolvedValue(pedido);

    const resultado = await service.aprobarTransferencia(pedido.external_id);

    expect(createRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(cobrosService.tieneCobroFacturaDelPedido).toHaveBeenCalledWith(
      'FX',
      'X 00001 00000001',
      pedido,
    );
    expect(stockService.confirmarStockLote).toHaveBeenCalledWith([
      { item: 'ITEM-1', cantidad: 1, deposito: 'DEPOSITO' },
      { item: 'ITEM-2', cantidad: 2, deposito: 'DEPOSITO' },
    ]);
    expect(createRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'APROBADO' }),
    );
    expect(resultado.pedido.estado).toBe('APROBADO');
  });

  it('no toca stock si el cobro no pertenece al pedido', async () => {
    const pedido = {
      id: 901,
      external_id: 'pedido-cobro-invalido',
      estado: 'PENDIENTE',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000002',
      productos: [{ nombre: 'ITEM-1', cantidad: 1 }],
    };
    createRepo.findOne.mockResolvedValue(pedido);
    cobrosService.tieneCobroFacturaDelPedido.mockResolvedValueOnce(false);

    await expect(
      service.aprobarTransferencia(pedido.external_id),
    ).rejects.toThrow('no tiene un cobro valido asociado');

    expect(stockService.confirmarStockLote).not.toHaveBeenCalled();
    expect(createRepo.save).not.toHaveBeenCalled();
  });

  it('restaura el lote confirmado si falla el guardado del pedido', async () => {
    const pedido = {
      id: 902,
      external_id: 'pedido-save-fallido',
      estado: 'PENDIENTE',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000003',
      productos: [{ nombre: 'ITEM-1', cantidad: 1 }],
    };
    const confirmaciones = [
      {
        item: 'ITEM-1',
        cantidad: 1,
        depositoReserva: 'DEPOSITO',
        salidas: [{ deposito: 'DEPOSITO', cantidad: 1 }],
      },
    ];
    createRepo.findOne.mockResolvedValue(pedido);
    stockService.confirmarStockLote.mockResolvedValueOnce(confirmaciones);
    createRepo.save.mockRejectedValueOnce(new Error('fallo guardando pedido'));

    await expect(
      service.aprobarTransferencia(pedido.external_id),
    ).rejects.toThrow('fallo guardando pedido');

    expect(stockService.restaurarStockConfirmadoLote).toHaveBeenCalledWith(
      confirmaciones,
    );
  });

  it('marca ERROR_STOCK cuando una transferencia cobrada no puede confirmar stock', async () => {
    const pedido = {
      id: 905,
      external_id: 'pedido-error-stock',
      estado: 'PENDIENTE',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000006',
      productos: [
        { nombre: 'ITEM-SIN-STOCK', cantidad: 2, deposito_reserva: 'GARAGE' },
      ],
    };
    createRepo.findOne.mockResolvedValue(pedido);
    stockService.confirmarStockLote.mockRejectedValueOnce(
      new Error('Stock fisico insuficiente para ITEM-SIN-STOCK'),
    );

    await expect(
      service.aprobarTransferencia(pedido.external_id),
    ).rejects.toThrow('Stock fisico insuficiente para ITEM-SIN-STOCK');

    expect(createRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'ERROR_STOCK' }),
    );
    expect(pedido.estado).toBe('ERROR_STOCK');
  });

  it('permite cancelar un pedido marcado con ERROR_STOCK', async () => {
    const pedido = {
      id: 906,
      external_id: 'pedido-error-stock-cancelable',
      estado: 'ERROR_STOCK',
      productos: [
        { nombre: 'ITEM-1', cantidad: 1, deposito_reserva: 'DEPOSITO' },
      ],
    };
    createRepo.findOne.mockResolvedValue(pedido);

    await expect(
      service.cancelarPedidoPendiente(pedido.external_id),
    ).resolves.toMatchObject({ estado: 'CANCELADO' });

    expect(stockService.liberarStock).toHaveBeenCalledWith(
      'ITEM-1',
      1,
      'DEPOSITO',
    );
  });

  it('es idempotente cuando la transferencia ya esta aprobada', async () => {
    const pedido = {
      id: 903,
      external_id: 'pedido-ya-aprobado',
      estado: 'APROBADO',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000004',
      productos: [{ nombre: 'ITEM-1', cantidad: 1 }],
    };
    createRepo.findOne.mockResolvedValue(pedido);

    await expect(
      service.aprobarTransferencia(pedido.external_id),
    ).resolves.toMatchObject({
      pedido,
      comprobante: {
        tipo: 'FX',
        comprobante: 'X 00001 00000004',
      },
    });

    expect(cobrosService.tieneCobroFacturaDelPedido).not.toHaveBeenCalled();
    expect(stockService.confirmarStockLote).not.toHaveBeenCalled();
    expect(createRepo.save).not.toHaveBeenCalled();
  });

  it('rechaza una segunda aprobacion concurrente en la misma instancia', async () => {
    const pedido = {
      id: 904,
      external_id: 'pedido-concurrente',
      estado: 'PENDIENTE',
      metodo_pago: 'transfer',
      comprobante_tipo: 'FX',
      comprobante_numero: 'X 00001 00000005',
      codigo_cupon: null,
      delivery_method: 'pickup',
      productos: [{ nombre: 'ITEM-1', cantidad: 1 }],
    };
    createRepo.findOne.mockResolvedValue(pedido);

    let resolverCobro: (value: boolean) => void = () => undefined;
    cobrosService.tieneCobroFacturaDelPedido.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolverCobro = resolve;
        }),
    );

    const primeraAprobacion = service.aprobarTransferencia(pedido.external_id);
    await Promise.resolve();

    await expect(
      service.aprobarTransferencia(pedido.external_id),
    ).rejects.toThrow('ya se esta aprobando en esta instancia');

    resolverCobro(true);
    await expect(primeraAprobacion).resolves.toMatchObject({
      pedido: expect.objectContaining({ estado: 'APROBADO' }),
    });
    expect(stockService.confirmarStockLote).toHaveBeenCalledTimes(1);
  });
});
