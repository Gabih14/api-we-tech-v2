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
});
