import { StkItemService } from './stk-item.service';

describe('StkItemService filtros jerárquicos de atributos', () => {
  const queryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
  };
  const itemRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const service = new StkItemService(
    itemRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.getRawMany.mockResolvedValue([]);
  });

  const ejecutarFiltro = async (filtros: Record<string, string>) => {
    await (service as any).filtrarIdsPorAtributos(filtros);
    const [sql, parametros] = queryBuilder.andWhere.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    return { sql, parametros };
  };

  it.each([
    ['PLA', 'PLA Boutique y PLA Astra'],
    ['PLA+', 'PLA+ Flex'],
    ['TPU', 'TPU SimpliFlex'],
  ])('material=%s busca por grupo_atributo e incluye %s', async (material) => {
    const { sql, parametros } = await ejecutarFiltro({ material });

    expect(sql).toContain('aPropio0.grupo_atributo = :grupo0');
    expect(sql).toContain('aPropio0.nombre = :nombre0');
    expect(parametros).toEqual(
      expect.objectContaining({
        clase0: 'Material',
        grupo0: material,
        nombre0: material,
      }),
    );
  });

  it('material=PLA no incluye el grupo PLA+ por coincidencias parciales', async () => {
    const { sql, parametros } = await ejecutarFiltro({ material: 'PLA' });

    expect(sql).not.toContain('LIKE');
    expect(parametros.grupo0).toBe('PLA');
  });

  it('combina material y submaterial sobre el mismo atributo Material', async () => {
    const { sql, parametros } = await ejecutarFiltro({
      material: 'PLA',
      submaterial: 'SILK',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
    expect(sql).toContain('aPropio0.grupo_atributo = :grupo0');
    expect(sql).toContain('aPropio0.subgrupo_atributo = :subgrupo0');
    expect(parametros).toEqual(
      expect.objectContaining({
        clase0: 'Material',
        grupo0: 'PLA',
        subgrupo0: 'SILK',
      }),
    );
  });

  it('conserva la búsqueda histórica por nombre exacto del material', async () => {
    const { sql, parametros } = await ejecutarFiltro({
      material: 'PLA Boutique',
    });

    expect(sql).toContain('OR aPropio0.nombre = :nombre0');
    expect(parametros.nombre0).toBe('PLA Boutique');
  });

  it('busca la marca base por grupo o por nombre histórico', async () => {
    const { sql, parametros } = await ejecutarFiltro({ marca: 'GRILON3' });

    expect(sql).toContain('aPropio0.grupo_atributo = :grupo0');
    expect(sql).toContain('OR aPropio0.nombre = :nombre0');
    expect(parametros).toEqual(
      expect.objectContaining({
        clase0: 'Marca',
        grupo0: 'GRILON3',
        nombre0: 'GRILON3',
      }),
    );
  });

  it('filtra submarca solo mediante una Sub-línea realmente asociada', async () => {
    const { sql, parametros } = await ejecutarFiltro({ submarca: 'BOUTIQUE' });

    expect(sql).toContain('aPropio0.subgrupo_atributo = :subgrupo0');
    expect(sql).toContain('OR aPropio0.nombre = :nombreSubgrupo0');
    expect(parametros).toEqual(
      expect.objectContaining({
        clase0: 'Sub-línea',
        subgrupo0: 'BOUTIQUE',
        nombreSubgrupo0: 'BOUTIQUE',
      }),
    );
  });

  it('solo hereda del padre cuando el hijo no sobrescribe esa clase', async () => {
    const { sql } = await ejecutarFiltro({ material: 'PLA' });

    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('nOverride0.arbol = i.id');
    expect(sql).toContain('aOverride0.clase = :clase0');
    expect(sql).toContain('nPadre0.arbol = i.id_padre');
  });
});
