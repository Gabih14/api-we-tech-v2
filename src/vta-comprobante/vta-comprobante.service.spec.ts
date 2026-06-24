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
      .mockImplementation(async (_tipo: string, letra: string) => {
        const puntoDeVenta = letra === 'X' ? '00001' : '00005';
        return `${letra} ${puntoDeVenta} 00000001`;
      });
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
        tipo: 'FX',
        comprobante: 'X 00001 00000001',
        total: 415,
        subtotal: 415,
        iva: 0,
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

  it('genera factura A con IVA discriminado', async () => {
    await service.crearDesdePedido({
      ...pedidoBase(
        [
          {
            nombre: 'ITEM-FAC-A',
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
            ajuste_porcentaje: null,
          },
        ],
        121,
      ),
      factura_tipo: 'A',
      factura_iva_porcentaje: 21,
      factura_iva_importe: 21,
    } as Pedido);

    expect(service['generarNumeroComprobante']).toHaveBeenCalledWith('FA', 'A');
    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        condicionIva: 'RI',
      }),
    );
    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'FA',
        comprobante: 'A 00005 00000001',
        condicion_iva: 'RI',
        lista: 'MINORISTA CON IVA',
        ivainc: undefined,
        alicuota: undefined,
        anclar_precio: false,
        subtotal: 100,
        neto: 100,
        nogravado: 0,
        alicuotas: '21',
        iva: 21,
        total: 121,
        ajuste: undefined,
        ajuste_neto: undefined,
        ajuste_iva: undefined,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'ITEM-FAC-A',
        importe: 100,
        ajuste_iva: 21,
      }),
    );
  });

  it('genera factura B con IVA discriminado', async () => {
    await service.crearDesdePedido({
      ...pedidoBase(
        [
          {
            nombre: 'ITEM-FAC-B',
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
            ajuste_porcentaje: null,
          },
        ],
        121,
      ),
      factura_tipo: 'B',
      factura_iva_porcentaje: 21,
      factura_iva_importe: 21,
    } as Pedido);

    expect(service['generarNumeroComprobante']).toHaveBeenCalledWith('FB', 'B');
    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        condicionIva: 'CF',
      }),
    );
    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'FB',
        comprobante: 'B 00005 00000001',
        condicion_iva: 'CF',
        lista: 'MINORISTA CON IVA',
        ivainc: true,
        alicuota: undefined,
        anclar_precio: false,
        subtotal: 100,
        neto: 100,
        nogravado: 0,
        alicuotas: '21',
        iva: 21,
        total: 121,
        ajuste: undefined,
        ajuste_neto: undefined,
        ajuste_iva: undefined,
      }),
    );
    expect(comprobanteItemService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'ITEM-FAC-B',
        importe: 100,
        ajuste_iva: 21,
      }),
    );
  });

  it('mantiene ajustes de cabecera en facturas fiscales con descuento', async () => {
    await service.crearDesdePedido({
      ...pedidoBase(
        [
          {
            nombre: 'ITEM-FAC-A-DESC',
            cantidad: 1,
            precio_unitario: 85,
            subtotal: 85,
            ajuste_porcentaje: 15,
          },
        ],
        103,
      ),
      factura_tipo: 'A',
      factura_iva_porcentaje: 21,
      factura_iva_importe: 18,
    } as Pedido);

    expect(comprobanteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'FA',
        subtotal: 85,
        neto: 85,
        iva: 18,
        total: 103,
        ajuste: -15,
        ajuste_neto: -15,
        ajuste_iva: -3.15,
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
