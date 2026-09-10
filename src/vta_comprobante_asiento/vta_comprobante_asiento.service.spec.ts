import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobanteAsiento } from './entities/vta_comprobante_asiento.entity';
import { VtaComprobanteAsientoService } from './vta_comprobante_asiento.service';

describe('VtaComprobanteAsientoService', () => {
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
        query: jest.fn(async () => [{ id: '2026' }]),
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
          cuenta: '1.1.05.001.0000',
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
