import { ColorsService } from './colors.service';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { FILAMENT_CATEGORIES } from '../pricing/discounts';

describe('ColorsService', () => {
  it('permite crear colores con nombres repetidos si el id es distinto', async () => {
    const savedColor = {
      id: 'AMAR2',
      nombre: 'Amarillo',
      color: '#FFEE00',
      orden: null,
    };
    const atributosRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(savedColor),
    };
    const colorsBridgeRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue({ id: 1, stkAtributoId: 'AMAR2' }),
    };
    const service = new ColorsService(
      atributosRepository as never,
      colorsBridgeRepository as never,
      { exist: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.create({ id: 'AMAR2', name: 'Amarillo', hex: '#FFEE00' }),
    ).resolves.toMatchObject({ id: 'AMAR2', name: 'Amarillo' });
    expect(atributosRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'AMAR2' },
    });
  });

  it('reactiva un color eliminado logicamente al crearlo con el mismo id', async () => {
    const color = {
      id: 'AMARM',
      nombre: 'Amarillo anterior',
      color: '#000000',
      orden: 1,
    };
    const bridge = {
      id: 1,
      stkAtributoId: 'AMARM',
      colorGroupId: 6,
      active: false,
    };
    const atributosRepository = {
      findOne: jest.fn().mockResolvedValue(color),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const colorsBridgeRepository = {
      findOne: jest.fn().mockResolvedValue(bridge),
      save: jest.fn().mockImplementation(async (value) => value),
      findOneOrFail: jest.fn().mockImplementation(async () => ({
        ...bridge,
        colorGroup: {
          id: 7,
          name: 'Amarillo',
          hex: '#FFFF00',
          sortOrder: 0,
        },
      })),
    };
    const service = new ColorsService(
      atributosRepository as never,
      colorsBridgeRepository as never,
      { exist: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
    );

    await expect(
      service.create({
        id: 'amarm',
        name: 'Amarillo Matte',
        hex: '#ffdd00',
        order: 10,
        colorGroupId: 7,
      }),
    ).resolves.toMatchObject({
      id: 'AMARM',
      name: 'Amarillo Matte',
      hex: '#FFDD00',
      order: 10,
      colorGroupId: 7,
    });
    expect(bridge).toMatchObject({ colorGroupId: 7, active: true });
    expect(atributosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Amarillo Matte',
        color: '#FFDD00',
        orden: 10,
      }),
    );
  });

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

  it('cambia un color de un grupo existente a otro', async () => {
    const color = { id: 'AMARM', nombre: 'Amarillo Matte', color: '#FFDD00' };
    const bridge = { id: 1, stkAtributoId: 'AMARM', colorGroupId: 6 };
    const updatedBridge = {
      ...bridge,
      colorGroupId: 7,
      colorGroup: { id: 7, name: 'Nuevo grupo', hex: null, sortOrder: 0 },
    };
    const colorsBridgeRepository = {
      findOne: jest.fn().mockResolvedValue(bridge),
      save: jest.fn().mockImplementation(async (value) => ({ ...value })),
      findOneOrFail: jest.fn().mockResolvedValue(updatedBridge),
    };
    const service = new ColorsService(
      {
        findOne: jest.fn().mockResolvedValue(color),
        save: jest.fn().mockResolvedValue(color),
      } as never,
      colorsBridgeRepository as never,
      { exist: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
    );

    await expect(
      service.update('AMARM', { colorGroupId: 7 }),
    ).resolves.toMatchObject({ colorGroupId: 7, colorGroup: { id: 7 } });
    expect(colorsBridgeRepository.findOne).toHaveBeenCalledWith({
      where: { stkAtributoId: 'AMARM' },
    });
    expect(colorsBridgeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ colorGroupId: 7 }),
    );
  });
});
