import { VtaComprobanteService } from './vta-comprobante.service';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { VtaComprobanteItem } from 'src/vta-comprobante-item/entities/vta-comprobante-item.entity';

describe('VtaComprobanteService crearDesdePedido', () => {
  const comprobanteDelete = jest.fn(async () => undefined);
  const itemDelete = jest.fn(async () => undefined);
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: (target: unknown) => ({
          delete:
            target === VtaComprobanteItem ? itemDelete : comprobanteDelete,
        }),
      }),
    ),
  };
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
      cliente_direccion: null,
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
        anclar_precio: true,
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
        ivainc: undefined,
        alicuota: 21,
        iva: 21,
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
        anclar_precio: true,
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
        ivainc: true,
        alicuota: 21,
        iva: 21,
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
        ajuste_iva: -3.16,
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

  it('crea o actualiza vta_cliente con la direccion declarada por el cliente', async () => {
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
      cliente_ubicacion: 'Dorrego 229, M5539 Las Heras, Mendoza, Argentina',
      cliente_direccion:
        'B° Unidad Latinoamérica MC C3, Las Heras, Mendoza, AR, 5539',
    } as Pedido);

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: 'B° Unidad Latinoamérica MC C3',
        localidad: 'Las Heras',
        provincia: 'Mendoza',
        cpa: '5539',
      }),
    );
  });

  it('separa el CPA de la localidad cuando Google los manda pegados', async () => {
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
      cliente_ubicacion:
        'Independencia 2094, M5539 Las Heras, Mendoza, Argentina',
    } as Pedido);

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: 'Independencia 2094',
        localidad: 'Las Heras',
        provincia: 'Mendoza',
        cpa: 'M5539',
      }),
    );
  });

  it('no deja el formatted_address crudo en direccion cuando vienen 3 partes', async () => {
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
      cliente_ubicacion: '9 de Julio 1779, M5500AMC Mendoza, Argentina',
    } as Pedido);

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: '9 de Julio 1779',
        provincia: 'Mendoza',
        cpa: 'M5500AMC',
      }),
    );
  });

  it('no confunde la altura con el CPA cuando la calle tiene piso', async () => {
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
      cliente_ubicacion: 'Jujuy 984 4, M5502HAN Mendoza, Argentina',
    } as Pedido);

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        direccion: 'Jujuy 984 4',
        provincia: 'Mendoza',
        cpa: 'M5502HAN',
      }),
    );
  });

  it('usa CUIL como tipo de documento para consumidor final', async () => {
    await service.crearDesdePedido(
      pedidoBase(
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
      ) as Pedido,
    );

    expect(clienteService.findOrCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tipoDocumento: 'CUIL', condicionIva: 'CF' }),
    );
  });

  it('elimina comprobante e items si falla la creacion del asiento', async () => {
    vtaComprobanteAsientoService.createAsientoForComprobante.mockRejectedValueOnce(
      new Error('fallo de asiento'),
    );

    await expect(
      service.crearDesdePedido(
        pedidoBase(
          [
            {
              nombre: 'ITEM-1',
              cantidad: 1,
              precio_unitario: 100,
              subtotal: 100,
              ajuste_porcentaje: null,
            },
          ],
          100,
        ),
      ),
    ).rejects.toThrow('fallo de asiento');

    expect(itemDelete).toHaveBeenCalledWith({
      tipo: 'FX',
      comprobante: 'X 00001 00000001',
    });
    expect(comprobanteDelete).toHaveBeenCalledWith({
      tipo: 'FX',
      comprobante: 'X 00001 00000001',
    });
  });
});
