import { ColorsService } from './colors.service';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { FILAMENT_CATEGORIES } from '../pricing/discounts';

describe('ColorsService', () => {
  it('lista los items que no tienen atributos de color asignados', async () => {
    const expected = [{ id: 'ITEM-1', descripcion: 'Item sin color' }];
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(expected),
    };
    const itemRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(itemRepository),
    };
    const service = new ColorsService(
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
    );

    await expect(service.getItemsWithoutColors()).resolves.toEqual(expected);
    expect(dataSource.getRepository).toHaveBeenCalledWith(StkItem);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      { colorClass: 'Colores' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'UPPER(TRIM(i.grupo)) IN (:...filamentGroups)',
      { filamentGroups: [...FILAMENT_CATEGORIES] },
    );
  });

  it('lista los filamentos que tienen asignado un color', async () => {
    const expected = [{ id: 'ITEM-1', descripcion: 'Filamento negro' }];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(expected),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    };
    const service = new ColorsService(
      { findOne: jest.fn().mockResolvedValue({ id: 'NEGRO' }) } as never,
      {} as never,
      {} as never,
      dataSource as never,
    );

    await expect(service.getColorItems('negro')).resolves.toEqual(expected);
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'n',
      'n.arbol = i.id AND n.atributo = :id',
      { id: 'NEGRO' },
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'UPPER(TRIM(i.grupo)) IN (:...filamentGroups)',
      { filamentGroups: [...FILAMENT_CATEGORIES] },
    );
  });

  it('desactiva el puente sin borrar el color del ERP', async () => {
    const color = { id: 'NEGRO', nombre: 'Negro', color: '#000000', orden: 1 };
    const bridge = { id: 1, stkAtributoId: 'NEGRO', active: true };
    const atributosRepository = {
      findOne: jest.fn().mockResolvedValue(color),
    };
    const colorsBridgeRepository = {
      findOne: jest.fn().mockResolvedValue(bridge),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const service = new ColorsService(
      atributosRepository as never,
      colorsBridgeRepository as never,
      {} as never,
      {} as never,
    );

    await expect(service.deactivate('negro')).resolves.toMatchObject({
      id: 'NEGRO',
      name: 'Negro',
    });
    expect(bridge.active).toBe(false);
    expect(colorsBridgeRepository.save).toHaveBeenCalledWith(bridge);
    expect(atributosRepository).not.toHaveProperty('delete');
  });
});
