import { StkExistenciaService } from './stk-existencia.service';

describe('StkExistenciaService', () => {
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  };

  let service: StkExistenciaService;

  beforeEach(() => {
    jest.clearAllMocks();
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
});
