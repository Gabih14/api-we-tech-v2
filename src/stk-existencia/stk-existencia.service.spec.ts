import { StkExistenciaService } from './stk-existencia.service';

describe('StkExistenciaService', () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (value) => value),
    manager: {
      transaction: jest.fn(),
    },
  };

  let service: StkExistenciaService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.manager.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => repo }),
    );
    service = new StkExistenciaService(repo as any);
  });

  it('devuelve el deposito usado al confirmar stock', async () => {
    repo.findOne.mockResolvedValue({
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '2',
    });

    await expect(service.confirmarStock('ITEM-1', 1, 'DEPOSITO')).resolves.toBe(
      'DEPOSITO',
    );
  });

  it('restaura existencia y compromiso despues de una confirmacion fallida', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '9',
      comprometido: '1',
    };
    repo.findOne.mockResolvedValue(existencia);

    await service.restaurarStockConfirmado('ITEM-1', 1, 'DEPOSITO');

    expect(existencia).toMatchObject({
      cantidad: '10',
      comprometido: '2',
    });
    expect(repo.save).toHaveBeenCalledWith(existencia);
  });

  it('ignora los items virtuales de envio al restaurar', async () => {
    await service.restaurarStockConfirmado('ENV-DELIVERY', 1, 'ENV');
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('valida el lote completo antes de modificar existencias', async () => {
    const itemValido = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '1',
    };
    const itemSinStockFisico = {
      item: 'ITEM-2',
      deposito: 'DEPOSITO',
      cantidad: '0',
      comprometido: '1',
    };
    repo.find.mockImplementation(async ({ where }) =>
      where.item === 'ITEM-1' ? [itemValido] : [itemSinStockFisico],
    );

    await expect(
      service.confirmarStockLote([
        { item: 'ITEM-1', cantidad: 1 },
        { item: 'ITEM-2', cantidad: 1 },
      ]),
    ).rejects.toThrow(
      'Stock fisico insuficiente para ITEM-2. Utilizable entre depositos: 0, Solicitado: 1, Reserva en DEPOSITO: 1',
    );

    expect(itemValido).toMatchObject({
      cantidad: '10',
      comprometido: '1',
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('agrupa productos repetidos y confirma el lote en una transaccion', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '3',
    };
    repo.find.mockResolvedValue([existencia]);

    await expect(
      service.confirmarStockLote([
        { item: 'ITEM-1', cantidad: 1 },
        { item: 'ITEM-1', cantidad: 2 },
      ]),
    ).resolves.toEqual([
      {
        item: 'ITEM-1',
        cantidad: 3,
        depositoReserva: 'DEPOSITO',
        salidas: [{ deposito: 'DEPOSITO', cantidad: 3 }],
      },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '7',
      comprometido: '0',
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('restaura un lote confirmado de forma transaccional', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '7',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([existencia]);

    await service.restaurarStockConfirmadoLote([
      {
        item: 'ITEM-1',
        cantidad: 3,
        depositoReserva: 'DEPOSITO',
        salidas: [{ deposito: 'DEPOSITO', cantidad: 3 }],
      },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '10',
      comprometido: '3',
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('mantiene la reserva original y permite sacar stock de otros depositos', async () => {
    const garage = {
      item: 'ITEM-1',
      deposito: 'GARAGE',
      cantidad: '0',
      comprometido: '2',
    };
    const local = {
      item: 'ITEM-1',
      deposito: 'LOCAL',
      cantidad: '1',
      comprometido: '0',
    };
    const deposito = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '1',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([garage, local, deposito]);

    const confirmaciones = await service.confirmarStockLote([
      { item: 'ITEM-1', cantidad: 2, deposito: 'GARAGE' },
    ]);

    expect(confirmaciones).toEqual([
      {
        item: 'ITEM-1',
        cantidad: 2,
        depositoReserva: 'GARAGE',
        salidas: [
          { deposito: 'LOCAL', cantidad: 1 },
          { deposito: 'DEPOSITO', cantidad: 1 },
        ],
      },
    ]);

    expect(garage).toMatchObject({ cantidad: '0', comprometido: '0' });
    expect(local.cantidad).toBe('0');
    expect(deposito.cantidad).toBe('0');

    await service.restaurarStockConfirmadoLote(confirmaciones);

    expect(garage).toMatchObject({ cantidad: '0', comprometido: '2' });
    expect(local.cantidad).toBe('1');
    expect(deposito.cantidad).toBe('1');
  });

  it('no asigna dos veces el mismo stock fisico a reservas distintas', async () => {
    const reservaA = {
      item: 'ITEM-1',
      deposito: 'RESERVA-A',
      cantidad: '0',
      comprometido: '1',
    };
    const reservaB = {
      item: 'ITEM-1',
      deposito: 'RESERVA-B',
      cantidad: '0',
      comprometido: '1',
    };
    const salida = {
      item: 'ITEM-1',
      deposito: 'LOCAL',
      cantidad: '1',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([reservaA, reservaB, salida]);

    await expect(
      service.confirmarStockLote([
        { item: 'ITEM-1', cantidad: 1, deposito: 'RESERVA-A' },
        { item: 'ITEM-1', cantidad: 1, deposito: 'RESERVA-B' },
      ]),
    ).rejects.toThrow('Stock fisico insuficiente para ITEM-1');

    expect(reservaA.comprometido).toBe('1');
    expect(reservaB.comprometido).toBe('1');
    expect(salida.cantidad).toBe('1');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
