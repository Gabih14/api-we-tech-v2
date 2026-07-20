import { PedidoSerieService } from './pedido-serie.service';
import { PedidoItemSerieEstado } from './entities/pedido-item-serie.entity';

describe('PedidoSerieService', () => {
  const queryBuilder = (rows: any[]) => {
    const qb: any = {
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      groupBy: jest.fn(() => qb),
      getRawMany: jest.fn(async () => rows),
    };
    return qb;
  };

  it('resta reservas activas de las series externas abiertas', async () => {
    const configRepo = {};
    const reservaRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder([{ item: 'BL-A1', cantidad: '1' }])),
    };
    const serieRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder([{ item: 'BL-A1', cantidad: '3' }])),
    };
    const service = new PedidoSerieService(
      configRepo as any,
      reservaRepo as any,
      serieRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const disponibilidad = await service.disponibilidadSeries(['BL-A1']);

    expect(disponibilidad.get('BL-A1')).toBe(2);
  });

  it('reserva por FIFO y conserva item más serie como identidad', async () => {
    const saved: any[] = [];
    const configRepo = {
      find: jest.fn(async () => [
        { item: 'BL-A1COMBO', controla_serie: true, habilitado_web: true },
      ]),
    };
    const reservaRepo = { find: jest.fn(async () => []) };
    const serieRepo = {
      find: jest.fn(async () => [
        { item: 'BL-A1COMBO', serie: 'SERIE-1', ingreso: '2026-01-01', egreso: null },
        { item: 'BL-A1COMBO', serie: 'SERIE-2', ingreso: '2026-01-02', egreso: null },
      ]),
    };
    const managerRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (values) => saved.push(...values)),
    };
    const backDataSource = {
      transaction: jest.fn(async (callback) =>
        callback({ getRepository: () => managerRepo }),
      ),
    };
    const service = new PedidoSerieService(
      configRepo as any,
      reservaRepo as any,
      serieRepo as any,
      backDataSource as any,
      {} as any,
      {} as any,
    );
    const pedido: any = {
      id: 10,
      productos: [{ id: 20, nombre: 'BL-A1COMBO', cantidad: 1 }],
    };

    await service.reservarParaPedido(pedido, 30);

    expect(saved).toEqual([
      expect.objectContaining({
        pedido_id: 10,
        pedido_item_id: 20,
        item: 'BL-A1COMBO',
        serie: 'SERIE-1',
        estado: PedidoItemSerieEstado.RESERVADA,
      }),
    ]);
  });
});
