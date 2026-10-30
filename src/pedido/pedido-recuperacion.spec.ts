import { NotFoundException } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { Pedido } from './entities/pedido.entity';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'pedido-test') }));

describe('Recuperacion de pedidos', () => {
  function setup(
    origen = 'CANCELADO',
    reservaEstado: string | null = 'LIBERADA',
  ) {
    let guardado = {
      id: 1,
      external_id: 'pedido-1',
      estado: origen,
      metodo_pago: 'online',
      stock_reserva_id: reservaEstado ? 'reserva-1' : null,
      motivo_cancelacion: 'Cancelado por expiracion',
      creado: new Date('2026-01-01T12:00:00Z'),
      aprobado: null,
      productos: [
        { nombre: 'ITEM-1', cantidad: 2, deposito_reserva: 'ANTERIOR' },
      ],
      codigo_cupon: 'CUPON',
      cliente_cuit: '123',
    } as Pedido;
    const items = [{ item: 'ITEM-1', cantidad: 2, deposito: 'NUEVO' }];
    const stock = {
      obtenerTrazabilidadReserva: jest.fn(async () => {
        if (!reservaEstado) throw new NotFoundException();
        return { reserva: { id: 'reserva-1', estado: reservaEstado }, items };
      }),
      reservarStockLote: jest.fn(async () =>
        items.map((i) => ({ ...i, reservaId: 'reserva-1' })),
      ),
      confirmarStockLote: jest.fn(async () =>
        items.map((i) => ({ ...i, depositoReserva: i.deposito })),
      ),
      restaurarStockConfirmadoLote: jest.fn(async () => undefined),
      liberarStockLote: jest.fn(async () => undefined),
    };
    // Simula el bloqueo exclusivo y rollback de la cabecera entre solicitudes.
    let cola = Promise.resolve();
    const repo = {
      findOne: jest.fn(async () => structuredClone(guardado)),
      save: jest.fn(async (pedido: Pedido) => pedido),
      manager: {
        transaction: jest.fn(async (callback) => {
          const anterior = cola;
          let liberar!: () => void;
          cola = new Promise<void>((resolve) => {
            liberar = resolve;
          });
          await anterior;
          try {
            let nuevo: Pedido | undefined;
            await callback({
              getRepository: () => ({
                findOne: repo.findOne,
                save: async (p: Pedido) => {
                  nuevo = await repo.save(p);
                  return nuevo;
                },
              }),
            });
            if (nuevo) guardado = structuredClone(nuevo);
          } finally {
            liberar();
          }
        }),
      },
    };
    const comprobantes = {
      crearDesdePedido: jest.fn(async () => ({
        tipo: 'FX',
        comprobante: 'X 1',
      })),
    };
    const cupon = { usarCupon: jest.fn(async () => undefined) };
    const cobros = { cobrarFactura: jest.fn() };
    const service = new PedidoService(
      repo as any,
      {} as any,
      {} as any,
      stock as any,
      comprobantes as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      cobros as any,
      cupon as any,
      {} as any,
      {} as any,
    );
    const notificar = jest
      .spyOn(service as any, 'notificarPedidoAprobado')
      .mockResolvedValue(undefined);
    return {
      service,
      repo,
      stock,
      comprobantes,
      cupon,
      cobros,
      notificar,
      actual: () => guardado,
      items,
    };
  }

  it.each(['CANCELADO', 'CANCELADO_MANUAL'])(
    'recupera %s a PENDIENTE con reserva renovada',
    async (origen) => {
      const { service, stock, comprobantes, notificar, repo } = setup(origen);
      const pedido = await service.recuperarPedido('pedido-1', 'PENDIENTE');
      expect(pedido).toMatchObject({
        estado: 'PENDIENTE',
        recuperado: expect.any(Date),
        aprobado: null,
        motivo_cancelacion: 'Cancelado por expiracion',
        creado: new Date('2026-01-01T12:00:00Z'),
        productos: [{ deposito_reserva: 'NUEVO' }],
      });
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(stock.confirmarStockLote).not.toHaveBeenCalled();
      expect(comprobantes.crearDesdePedido).not.toHaveBeenCalled();
      expect(notificar).not.toHaveBeenCalled();
    },
  );

  it.each(['CANCELADO', 'CANCELADO_MANUAL'])(
    'recupera %s a APROBADO sin cobrar',
    async (origen) => {
      const { service, stock, comprobantes, cobros, cupon, notificar } =
        setup(origen);
      await expect(
        service.recuperarPedido('pedido-1', 'APROBADO'),
      ).resolves.toMatchObject({
        estado: 'APROBADO',
        aprobado: expect.any(Date),
        comprobante_numero: 'X 1',
      });
      expect(stock.confirmarStockLote).toHaveBeenCalledTimes(1);
      expect(comprobantes.crearDesdePedido).toHaveBeenCalledWith(
        expect.anything(),
        false,
      );
      expect(cobros.cobrarFactura).not.toHaveBeenCalled();
      expect(cupon.usarCupon).toHaveBeenCalledTimes(1);
      expect(notificar).toHaveBeenCalledTimes(1);
    },
  );

  it('asegura el comprobante pendiente de una transferencia', async () => {
    const { service, actual, comprobantes } = setup();
    actual().metodo_pago = 'transfer';
    await service.recuperarPedido('pedido-1', 'PENDIENTE');
    expect(comprobantes.crearDesdePedido).toHaveBeenCalledWith(
      expect.anything(),
      false,
    );
  });

  it('no duplica confirmaciones, comprobantes, cupones ni avisos con solicitudes simultaneas o reintentos', async () => {
    const { service, stock, comprobantes, cupon, notificar } = setup();
    const resultados = await Promise.allSettled([
      service.recuperarPedido('pedido-1', 'APROBADO'),
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('no esta cancelado');
    expect(stock.reservarStockLote).toHaveBeenCalledTimes(1);
    expect(stock.confirmarStockLote).toHaveBeenCalledTimes(1);
    expect(comprobantes.crearDesdePedido).toHaveBeenCalledTimes(1);
    expect(cupon.usarCupon).toHaveBeenCalledTimes(1);
    expect(notificar).toHaveBeenCalledTimes(1);
  });

  it('conserva la cancelacion si falta stock', async () => {
    const { service, stock, repo, actual } = setup();
    stock.reservarStockLote.mockRejectedValueOnce(
      new Error('Stock insuficiente'),
    );
    await expect(
      service.recuperarPedido('pedido-1', 'PENDIENTE'),
    ).rejects.toThrow('Stock insuficiente');
    expect(actual().estado).toBe('CANCELADO');
    expect(repo.save).not.toHaveBeenCalled();
    expect(stock.liberarStockLote).not.toHaveBeenCalled();
  });

  it.each(['comprobante', 'guardado'])(
    'compensa stock al fallar el %s',
    async (fallo) => {
      const { service, stock, repo, comprobantes, actual, notificar } = setup();
      if (fallo === 'comprobante')
        comprobantes.crearDesdePedido.mockRejectedValueOnce(new Error('fallo'));
      else repo.save.mockRejectedValueOnce(new Error('fallo'));
      await expect(
        service.recuperarPedido('pedido-1', 'APROBADO'),
      ).rejects.toThrow('fallo');
      expect(actual().estado).toBe('CANCELADO');
      expect(stock.restaurarStockConfirmadoLote).toHaveBeenCalledTimes(1);
      expect(stock.liberarStockLote).toHaveBeenCalledWith(
        [
          {
            item: 'ITEM-1',
            cantidad: 2,
            deposito: 'NUEVO',
            reservaId: 'reserva-1',
          },
        ],
        'reserva-1',
        'Fallo al recuperar el pedido',
      );
      expect(notificar).not.toHaveBeenCalled();
    },
  );

  it('mantiene una reserva previamente activa si falla el guardado', async () => {
    const { service, stock, repo } = setup('CANCELADO_MANUAL', 'RESERVADA');
    repo.save.mockRejectedValueOnce(new Error('fallo'));
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('fallo');
    expect(stock.restaurarStockConfirmadoLote).toHaveBeenCalledTimes(1);
    expect(stock.liberarStockLote).not.toHaveBeenCalled();
  });

  it('reutiliza stock ya confirmado al aprobar', async () => {
    const { service, stock } = setup('CANCELADO_MANUAL', 'CONFIRMADA');
    await service.recuperarPedido('pedido-1', 'APROBADO');
    expect(stock.reservarStockLote).not.toHaveBeenCalled();
    expect(stock.confirmarStockLote).not.toHaveBeenCalled();
  });

  it('compensa un fallo al confirmar la transaccion de pedidos', async () => {
    const { service, repo, stock, notificar } = setup();
    repo.manager.transaction.mockImplementationOnce(async (callback) => {
      await callback({ getRepository: () => repo });
      throw new Error('fallo commit');
    });
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('fallo commit');
    expect(stock.restaurarStockConfirmadoLote).toHaveBeenCalledTimes(1);
    expect(stock.liberarStockLote).toHaveBeenCalledTimes(1);
    expect(notificar).not.toHaveBeenCalled();
  });

  it('no revierte stock previamente confirmado cuando falla el comprobante', async () => {
    const { service, stock, comprobantes } = setup(
      'CANCELADO_MANUAL',
      'CONFIRMADA',
    );
    comprobantes.crearDesdePedido.mockRejectedValueOnce(
      new Error('fallo comprobante'),
    );
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('fallo comprobante');
    expect(stock.restaurarStockConfirmadoLote).not.toHaveBeenCalled();
    expect(stock.liberarStockLote).not.toHaveBeenCalled();
  });

  it('impide volver a pendiente con stock confirmado', async () => {
    const { service, repo } = setup('CANCELADO_MANUAL', 'CONFIRMADA');
    await expect(
      service.recuperarPedido('pedido-1', 'PENDIENTE'),
    ).rejects.toThrow('solo se puede recuperar a APROBADO');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza cancelaciones manuales sin trazabilidad', async () => {
    const { service, stock } = setup('CANCELADO_MANUAL', null);
    await expect(
      service.recuperarPedido('pedido-1', 'PENDIENTE'),
    ).rejects.toThrow('revision manual');
    expect(stock.reservarStockLote).not.toHaveBeenCalled();
  });

  it('crea reserva para un cancelado normal anterior a las reservas persistentes', async () => {
    const { service, stock } = setup('CANCELADO', null);
    await service.recuperarPedido('pedido-1', 'PENDIENTE');
    expect(stock.reservarStockLote).toHaveBeenCalledTimes(1);
  });

  it.each([
    'PENDIENTE',
    'APROBADO',
    'APROBADO_MANUAL',
    'ERROR_STOCK',
    'REQUIERE_ATENCION',
  ])('rechaza recuperar un %s', async (origen) => {
    const { service, stock } = setup(origen);
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('no esta cancelado');
    expect(stock.reservarStockLote).not.toHaveBeenCalled();
  });

  it('rechaza pedidos inexistentes, destinos invalidos y reservas inconsistentes', async () => {
    const { service, repo, items } = setup();
    await expect(
      service.recuperarPedido('pedido-1', 'OTRO' as any),
    ).rejects.toThrow('El estado');
    items[0].cantidad = 3;
    await expect(
      service.recuperarPedido('pedido-1', 'APROBADO'),
    ).rejects.toThrow('no coincide');
    repo.findOne.mockResolvedValueOnce(null as any);
    await expect(
      service.recuperarPedido('inexistente', 'PENDIENTE'),
    ).rejects.toThrow('no encontrado');
  });
});
