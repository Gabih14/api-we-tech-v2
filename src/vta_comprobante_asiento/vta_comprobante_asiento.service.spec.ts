import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobanteAsiento } from './entities/vta_comprobante_asiento.entity';
import { VtaComprobanteAsientoService } from './vta_comprobante_asiento.service';

function crearEscenario(items: any[], total: number, iva = 0) {
  const save = jest.fn(async (_entity, value) => value);
  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(async (sql: string) =>
      sql.includes('vta_comprobante_item') ? items : [{ id: '2026' }],
    ),
    manager: {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ next: 1 })),
      })),
      save,
    },
  };
  const service = new VtaComprobanteAsientoService(
    { createQueryRunner: () => qr } as any,
    { create: (value) => value } as any,
    {} as any,
    {
      findOne: jest.fn(async () => ({
        total,
        iva,
        fecha: new Date('2026-10-20'),
        comprobante: 'X 00001 00024142',
      })),
    } as any,
    { create: (value) => value } as any,
  );
  const generar = (tipo = 'FX') =>
    service.createAsientoForComprobante(tipo, 'X 00001 00024142', 'online');
  const movimientos = () =>
    save.mock.calls.find(([entity]) => entity === CntMovimiento)?.[1];
  return { qr, save, generar, movimientos };
}

describe('VtaComprobanteAsientoService', () => {
  it('agrupa ventas con descuento por rubro y separa el envio sin cambiar el Debe', async () => {
    const escenario = crearEscenario(
      [
        { item: 'FIL-1', rubro: 'MERCADERIA FILAMENTO', importe: '11999.00' },
        { item: 'FIL-2', rubro: 'MERCADERIA FILAMENTO', importe: '10000.00' },
        { item: 'REP', rubro: 'MERCADERIA REPUESTOS', importe: '3545.00' },
        { item: 'ENV', rubro: 'VENTA ENVIO CLIENTE', importe: '4399.00' },
      ],
      29943,
    );
    await escenario.generar();
    expect(escenario.movimientos()).toEqual([
      expect.objectContaining({
        numero: 1,
        cuenta: '4.1.01.001.0000',
        debe: null,
        haber: 21999,
      }),
      expect.objectContaining({
        numero: 2,
        cuenta: '4.1.01.003.0000',
        debe: null,
        haber: 3545,
      }),
      expect.objectContaining({
        numero: 3,
        cuenta: '4.1.01.007.0000',
        debe: null,
        haber: 4399,
      }),
      expect.objectContaining({
        numero: 4,
        cuenta: '1.1.01.005.0001',
        debe: 29943,
        haber: null,
      }),
    ]);
  });

  it.each(['FA', 'FB'])(
    'separa IVA sin descontarlo otra vez del neto en %s',
    async (tipo) => {
      const escenario = crearEscenario(
        [
          {
            item: 'FIL',
            rubro: 'MERCADERIA FILAMENTO',
            importe: '85.00',
            iva: '18.00',
          },
        ],
        103,
        18,
      );
      await escenario.generar(tipo);
      expect(escenario.movimientos()).toEqual([
        expect.objectContaining({ cuenta: '4.1.01.001.0000', haber: 85 }),
        expect.objectContaining({ cuenta: '2.1.04.001.0000', haber: 18 }),
        expect.objectContaining({ cuenta: '1.1.01.005.0001', debe: 103 }),
      ]);
    },
  );

  it.each([
    ['MERCADERIA IMPRESORA', '4.1.01.002.0000'],
    ['MERCADERIA ACCESORIO', '4.1.01.008.0000'],
    ['VENTA SERV TECNICO', '4.1.01.005.0000'],
    ['VENTA CURSOS', '4.1.01.006.0000'],
    ['VENTA DE FILAMENTO', '4.1.01.001.0000'],
  ])('usa la cuenta de ventas para %s', async (rubro, cuenta) => {
    const escenario = crearEscenario(
      [{ item: 'ITEM', rubro, importe: '100.00' }],
      100,
    );
    await escenario.generar();
    expect(escenario.movimientos()[0]).toEqual(
      expect.objectContaining({ cuenta, haber: 100 }),
    );
  });

  it('absorbe solo un centavo de redondeo en ventas', async () => {
    const escenario = crearEscenario(
      [{ item: 'FIL', rubro: 'MERCADERIA FILAMENTO', importe: '99.99' }],
      100,
    );
    await escenario.generar();
    expect(escenario.movimientos()[0].haber).toBe(100);
  });

  it.each([
    [[{ item: 'ITEM', rubro: null, importe: '100.00' }], 100, 0],
    [[{ item: 'ITEM', rubro: 'DESCONOCIDO', importe: '100.00' }], 100, 0],
    [
      [{ item: 'ITEM', rubro: 'MERCADERIA FILAMENTO', importe: '90.00' }],
      100,
      0,
    ],
    [
      [
        {
          item: 'ITEM',
          rubro: 'MERCADERIA FILAMENTO',
          importe: '100.00',
          iva: '20.00',
        },
      ],
      121,
      21,
    ],
    [
      [{ item: 'ITEM', rubro: 'MERCADERIA FILAMENTO', importe: 'invalido' }],
      100,
      0,
    ],
    [[], 100, 0],
  ])(
    'rechaza detalles invalidos sin guardar el asiento: %j',
    async (items, total, iva) => {
      const escenario = crearEscenario(items, total, iva);
      await expect(escenario.generar()).rejects.toThrow();
      expect(escenario.save).not.toHaveBeenCalled();
      expect(escenario.qr.rollbackTransaction).toHaveBeenCalled();
      expect(escenario.qr.release).toHaveBeenCalled();
    },
  );

  it.each([
    ['online', '1.1.01.005.0001'],
    ['transfer', '1.1.03.001.0000'],
    [undefined, '1.1.01.001.0000'],
    ['otro', '1.1.01.001.0000'],
  ])(
    'usa la cuenta correcta para metodo %s',
    async (metodoPago, cuentaDebe) => {
      const save = jest.fn(async (_entity, value) => value);
      const queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        query: jest.fn(async (sql: string) =>
          sql.includes('vta_comprobante_item')
            ? [
                {
                  item: 'FILAMENTO',
                  rubro: 'MERCADERIA FILAMENTO',
                  importe: '100.00',
                  iva: null,
                },
              ]
            : [{ id: '2026' }],
        ),
        manager: {
          createQueryBuilder: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn(async () => ({ next: 1 })),
          })),
          save,
        },
      };
      const service = new VtaComprobanteAsientoService(
        { createQueryRunner: () => queryRunner } as any,
        { create: (value) => value } as any,
        {} as any,
        {
          findOne: jest.fn(async () => ({
            total: 100,
            fecha: new Date('2026-09-10T00:00:00Z'),
            periodo: '09/2026',
            comprobante: 'X 00001 00000001',
            moneda: 'PES',
          })),
        } as any,
        { create: (value) => value } as any,
      );

      await service.createAsientoForComprobante(
        'FX',
        'X 00001 00000001',
        metodoPago,
      );

      const movimientos = save.mock.calls.find(
        ([entity]) => entity === CntMovimiento,
      )?.[1];

      expect(movimientos).toEqual([
        expect.objectContaining({
          cuenta: '4.1.01.001.0000',
          debe: null,
          haber: 100,
        }),
        expect.objectContaining({
          cuenta: cuentaDebe,
          debe: 100,
          haber: null,
        }),
      ]);
      expect(save).toHaveBeenCalledWith(CntAsiento, expect.any(Object));
      expect(save).toHaveBeenCalledWith(
        VtaComprobanteAsiento,
        expect.any(Object),
      );
    },
  );
});
