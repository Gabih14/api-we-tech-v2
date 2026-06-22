import { VtaComprobanteService } from './vta-comprobante.service';
import { Pedido } from 'src/pedido/entities/pedido.entity';

describe('VtaComprobanteService crearDesdePedido', () => {
  const dataSource = {};
  const comprobanteRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
  };
  const comprobanteItemService = {
    create: jest.fn(async (data) => data),
  };
  const clienteService = {
    findOrCreateOrUpdate: jest.fn(async (data) => ({
      razonSocial: data.razonSocial,
    })),
  };
  const vtaComprobanteAsientoService = {
    createAsientoForComprobante: jest.fn(async () => undefined),
  };

  let service: VtaComprobanteService;

  const pedidoBase = (productos: any[], total: number): Pedido =>
    ({
      cliente_cuit: '20123456789',
      cliente_nombre: 'Cliente Test',
      cliente_mail: 'cliente@test.com',
      telefono: '1111111111',
      cliente_ubicacion: 'Calle 123, Ciudad, Provincia, AR, 1000',
      observaciones_direccion: '',
      productos,
      total,
      metodo_pago: 'transfer',
    }) as Pedido;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VtaComprobanteService(
      dataSource as any,
      comprobanteRepository as any,
      comprobanteItemService as any,
      clienteService as any,
      vtaComprobanteAsientoService as any,
    );
    jest
      .spyOn(service as any, 'generarNumeroComprobante')
      .mockResolvedValue('X 00001 00000001');
  });

  it('registra ajuste de descuento usando ajuste_porcentaje del pedido', async () => {
    await service.crearDesdePedido(
      pedidoBase(
        [
          {
            nombre: 'G3-PLA1-1KG-NEGR',
            cantidad: 5,
            precio_unitario: 83,
            subtotal: 415,
            ajuste_porcentaje: 17,
          },
        ],
        415,
      ),
    );

    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 415,
        subtotal: 415,
        nogravado: 415,
        ajuste: -17,
        ajuste_neto: -85,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'G3-PLA1-1KG-NEGR',
        cantidad: 5,
        precio: 100,
        importe: 415,
        ajuste: -17,
        ajuste_neto: -85,
      }),
    );
  });

  it('no registra ajuste cuando el producto no tiene ajuste_porcentaje', async () => {
    await service.crearDesdePedido(
      pedidoBase(
        [
          {
            nombre: 'ITEM-SIN-AJUSTE',
            cantidad: 2,
            precio_unitario: 100,
            subtotal: 200,
            ajuste_porcentaje: null,
          },
        ],
        200,
      ),
    );

    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 200,
        ajuste: undefined,
        ajuste_neto: undefined,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'ITEM-SIN-AJUSTE',
        precio: 100,
        importe: 200,
        ajuste: undefined,
        ajuste_neto: undefined,
      }),
    );
  });

  it('calcula ajuste global de cabecera con productos mixtos', async () => {
    await service.crearDesdePedido(
      pedidoBase(
        [
          {
            nombre: 'G3-PLA1-1KG-NEGR',
            cantidad: 5,
            precio_unitario: 83,
            subtotal: 415,
            ajuste_porcentaje: 17,
          },
          {
            nombre: 'ITEM-SIN-AJUSTE',
            cantidad: 1,
            precio_unitario: 200,
            subtotal: 200,
            ajuste_porcentaje: null,
          },
        ],
        615,
      ),
    );

    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 615,
        ajuste: -12.14,
        ajuste_neto: -85,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        itemId: 'G3-PLA1-1KG-NEGR',
        precio: 100,
        importe: 415,
        ajuste: -17,
        ajuste_neto: -85,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        itemId: 'ITEM-SIN-AJUSTE',
        precio: 200,
        importe: 200,
        ajuste: undefined,
        ajuste_neto: undefined,
      }),
    );
  });
  it('toma la provincia correcta desde direcciones de Google Maps', async () => {
    await service.crearDesdePedido({
      ...pedidoBase(
        [
          {
            nombre: 'ITEM-SIN-AJUSTE',
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
            ajuste_porcentaje: null,
          },
        ],
        100,
      ),
      cliente_ubicacion: 'Joaquin V. Gonzalez 450, M5519, Mendoza, Argentina',
    } as Pedido);

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: 'Joaquin V. Gonzalez 450',
        provincia: 'Mendoza',
        cpa: 'M5519',
      }),
    );
  });
});
