import { StkExistenciaService } from './stk-existencia.service';

describe('StkExistenciaService', () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(async (value) => value),
    manager: {
      transaction: jest.fn(),
    },
  };
  const pedidoItemRepo = {
    createQueryBuilder: jest.fn(),
  };

  let service: StkExistenciaService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.manager.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => repo }),
    );
    service = new StkExistenciaService(repo as any, pedidoItemRepo as any);
  });

  function mockQueryBuilder(result: any[]) {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(result),
      getRawMany: jest.fn().mockResolvedValue(result),
    };
  }

  it('devuelve el deposito usado al confirmar stock', async () => {
    repo.find.mockResolvedValue([
      {
        item: 'ITEM-1',
        deposito: 'DEPOSITO',
        cantidad: '10',
        comprometido: '2',
      },
    ]);

    await expect(service.confirmarStock('ITEM-1', 1, 'DEPOSITO')).resolves.toBe(
      'DEPOSITO',
    );
  });

  it('reserva un lote restando existencia y aumentando compromiso', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '2',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([existencia]);

    await expect(
      service.reservarStockLote([{ item: 'ITEM-1', cantidad: 2 }]),
    ).resolves.toEqual([{ item: 'ITEM-1', cantidad: 2, deposito: 'DEPOSITO' }]);

    expect(existencia).toMatchObject({ cantidad: '0', comprometido: '2' });
    expect(repo.find).toHaveBeenCalledWith({
      where: { item: 'ITEM-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('no reserva parcialmente cuando productos repetidos superan existencia', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '2',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([existencia]);

    await expect(
      service.reservarStockLote([
        { item: 'ITEM-1', cantidad: 1 },
        { item: 'ITEM-1', cantidad: 2 },
      ]),
    ).rejects.toThrow('Stock insuficiente para ITEM-1');

    expect(existencia).toMatchObject({ cantidad: '2', comprometido: '0' });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('lista comprometidos con pedidos asignados y saldo sin pedido', async () => {
    repo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          cantidad: '10',
          comprometido: '3',
        },
      ]),
    );
    pedidoItemRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          pedido_id: 7,
          external_id: 'pedido-123',
          estado: 'PENDIENTE',
          metodo_pago: 'online',
          cliente_nombre: 'Cliente Test',
          cantidad: '2',
        },
      ]),
    );

    await expect(service.findComprometidosConPedidos()).resolves.toEqual([
      {
        item: 'ITEM-1',
        deposito: 'DEPOSITO',
        cantidad: 10,
        comprometido: 3,
        cantidad_asignada_a_pedidos: 2,
        cantidad_sin_pedido: 1,
        diferencia_comprometido: 1,
        pedidos: [
          {
            pedido_id: 7,
            external_id: 'pedido-123',
            estado: 'PENDIENTE',
            metodo_pago: 'online',
            cliente_nombre: 'Cliente Test',
            cantidad: 2,
          },
        ],
      },
    ]);
  });

  it('no consulta pedidos cuando no hay stock comprometido', async () => {
    repo.createQueryBuilder.mockReturnValue(mockQueryBuilder([]));

    await expect(service.findComprometidosConPedidos()).resolves.toEqual([]);
    expect(pedidoItemRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('restaura a existencia solo el comprometido sin pedido asignado', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '3',
    };
    repo.createQueryBuilder.mockReturnValue(mockQueryBuilder([existencia]));
    pedidoItemRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          pedido_id: 7,
          external_id: 'pedido-123',
          estado: 'PENDIENTE',
          metodo_pago: 'online',
          cliente_nombre: 'Cliente Test',
          cantidad: '2',
        },
      ]),
    );
    repo.findOne.mockResolvedValue(existencia);

    await expect(service.restaurarComprometidosSinPedido()).resolves.toEqual({
      restaurados: [
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          cantidad_restaurada: 1,
          cantidad_anterior: 10,
          cantidad_nueva: 11,
          comprometido_anterior: 3,
          comprometido_nuevo: 2,
        },
      ],
      total_items: 1,
      total_cantidad_restaurada: 1,
    });
    expect(existencia).toMatchObject({
      cantidad: '11',
      comprometido: '2',
    });
    expect(repo.save).toHaveBeenCalledWith(existencia);
  });

  it('no modifica stock si todo el comprometido pertenece a pedidos', async () => {
    repo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          cantidad: '10',
          comprometido: '2',
        },
      ]),
    );
    pedidoItemRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        {
          item: 'ITEM-1',
          deposito: 'DEPOSITO',
          pedido_id: 7,
          external_id: 'pedido-123',
          estado: 'PENDIENTE',
          metodo_pago: 'online',
          cliente_nombre: 'Cliente Test',
          cantidad: '2',
        },
      ]),
    );

    await expect(service.restaurarComprometidosSinPedido()).resolves.toEqual({
      restaurados: [],
      total_items: 0,
      total_cantidad_restaurada: 0,
    });
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('restaura solo el compromiso despues de una confirmacion fallida', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '9',
      comprometido: '1',
    };
    repo.findOne.mockResolvedValue(existencia);

    await service.restaurarStockConfirmado('ITEM-1', 1, 'DEPOSITO');

    expect(existencia).toMatchObject({
      cantidad: '9',
      comprometido: '2',
    });
    expect(repo.save).toHaveBeenCalledWith(existencia);
  });

  it('ignora los items virtuales de envio al restaurar', async () => {
    await service.restaurarStockConfirmado('ENV-DELIVERY', 1, 'ENV');
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('valida todo el lote antes de confirmar compromisos', async () => {
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
      comprometido: '0',
    };
    repo.find.mockImplementation(async ({ where }) =>
      where.item === 'ITEM-1' ? [itemValido] : [itemSinStockFisico],
    );

    await expect(
      service.confirmarStockLote([
        { item: 'ITEM-1', cantidad: 1 },
        { item: 'ITEM-2', cantidad: 1 },
      ]),
    ).rejects.toThrow('Reserva insuficiente para ITEM-2');

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
      },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '10',
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
      },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '7',
      comprometido: '3',
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('confirma la reserva sin tocar existencias de otros depositos', async () => {
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
      },
    ]);

    expect(garage).toMatchObject({ cantidad: '0', comprometido: '0' });
    expect(local.cantidad).toBe('1');
    expect(deposito.cantidad).toBe('1');

    await service.restaurarStockConfirmadoLote(confirmaciones);

    expect(garage).toMatchObject({ cantidad: '0', comprometido: '2' });
    expect(local.cantidad).toBe('1');
    expect(deposito.cantidad).toBe('1');
  });

  it('confirma compromisos independientes sin volver a descontar existencia', async () => {
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
    ).resolves.toHaveLength(2);

    expect(reservaA.comprometido).toBe('0');
    expect(reservaB.comprometido).toBe('0');
    expect(salida.cantidad).toBe('1');
    expect(repo.save).toHaveBeenCalled();
  });

  it('libera un lote completo en una transaccion', async () => {
    const item1 = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '3',
    };
    const item2 = {
      item: 'ITEM-2',
      deposito: 'LOCAL',
      cantidad: '5',
      comprometido: '2',
    };
    repo.find.mockImplementation(async ({ where }) =>
      where.item === 'ITEM-1' ? [item1] : [item2],
    );

    await service.liberarStockLote([
      { item: 'ITEM-1', cantidad: 2, deposito: 'DEPOSITO' },
      { item: 'ITEM-2', cantidad: 1, deposito: 'LOCAL' },
    ]);

    expect(item1.comprometido).toBe('1');
    expect(item2.comprometido).toBe('1');
    expect(item1.cantidad).toBe('12');
    expect(item2.cantidad).toBe('6');
    expect(repo.save).toHaveBeenCalledWith([item1, item2]);
  });

  it('aprueba quitando el compromiso sin tocar existencia', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '0',
      comprometido: '1',
    };
    repo.find.mockResolvedValue([existencia]);

    await service.confirmarStockLote([
      { item: 'ITEM-1', cantidad: 1, deposito: 'DEPOSITO' },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '0',
      comprometido: '0',
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('cancela una transferencia reponiendo existencia y quitando compromiso', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '0',
      comprometido: '1',
    };
    repo.find.mockResolvedValue([existencia]);

    await service.liberarStockLote([
      { item: 'ITEM-1', cantidad: 1, deposito: 'DEPOSITO' },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '1',
      comprometido: '0',
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('restaura solo el compromiso si falla el guardado de la aprobacion', async () => {
    const existencia = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '0',
      comprometido: '0',
    };
    repo.find.mockResolvedValue([existencia]);

    await service.restaurarStockConfirmadoLote([
      { item: 'ITEM-1', cantidad: 1, depositoReserva: 'DEPOSITO' },
    ]);

    expect(existencia).toMatchObject({
      cantidad: '0',
      comprometido: '1',
    });
    expect(repo.save).toHaveBeenCalledWith([existencia]);
  });

  it('no libera parcialmente cuando una reserva del lote es insuficiente', async () => {
    const item1 = {
      item: 'ITEM-1',
      deposito: 'DEPOSITO',
      cantidad: '10',
      comprometido: '3',
    };
    const item2 = {
      item: 'ITEM-2',
      deposito: 'LOCAL',
      cantidad: '5',
      comprometido: '0',
    };
    repo.find.mockImplementation(async ({ where }) =>
      where.item === 'ITEM-1' ? [item1] : [item2],
    );

    await expect(
      service.liberarStockLote([
        { item: 'ITEM-1', cantidad: 2, deposito: 'DEPOSITO' },
        { item: 'ITEM-2', cantidad: 1, deposito: 'LOCAL' },
      ]),
    ).rejects.toThrow('Reserva insuficiente para liberar ITEM-2');

    expect(item1.comprometido).toBe('3');
    expect(item2.comprometido).toBe('0');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
