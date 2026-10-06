import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoService } from './stk-atributo.service';

describe('StkAtributoService', () => {
  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  let service: StkAtributoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StkAtributoService,
        {
          provide: getRepositoryToken(StkAtributo),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(StkAtributoService);
  });

  it('aplica conjuntamente los filtros del listado', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await service.findAll({
      sinGrupo: true,
      sinSubgrupo: true,
      grupo: 'PLA',
      subgrupo: 'DECORATIVOS',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(4);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'atributo.grupo = :grupo',
      { grupo: 'PLA' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'atributo.subgrupo = :subgrupo',
      { subgrupo: 'DECORATIVOS' },
    );
  });

  it('devuelve grupos distintos proyectados como strings', async () => {
    queryBuilder.getRawMany.mockResolvedValue([{ grupo: 'PLA' }, { grupo: 'PETG' }]);

    await expect(service.findGrupos()).resolves.toEqual(['PLA', 'PETG']);
  });

  it('actualiza exclusivamente grupo y subgrupo', async () => {
    const atributo = {
      id: 'ATR1',
      nombre: 'Rojo',
      clase: 'Colores',
      grupo: 'ANTERIOR',
      subgrupo: null,
      color: '#ff0000',
      orden: 1,
    } as StkAtributo;
    repository.findOneBy.mockResolvedValue(atributo);
    repository.update.mockResolvedValue({ affected: 1 });

    const result = await service.updateClasificacion('ATR1', {
      grupo: 'PLA',
      subgrupo: 'DECORATIVOS',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'ATR1' },
      { grupo: 'PLA', subgrupo: 'DECORATIVOS' },
    );
    expect(result).toEqual({
      ...atributo,
      grupo: 'PLA',
      subgrupo: 'DECORATIVOS',
    });
  });

  it('permite quitar la clasificación con null', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'ATR1',
      grupo: 'PLA',
      subgrupo: 'DECORATIVOS',
    });
    repository.update.mockResolvedValue({ affected: 1 });

    await service.updateClasificacion('ATR1', {
      grupo: null,
      subgrupo: null,
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'ATR1' },
      { grupo: null, subgrupo: null },
    );
  });

  it('devuelve 404 si el atributo no existe', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.updateClasificacion('INEXISTENTE', { grupo: 'PLA' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
