import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminTaxonomiaService } from './admin-taxonomia.service';

describe('AdminTaxonomiaService', () => {
  const itemQuery = queryBuilder();
  const atributoQuery = queryBuilder();
  const nodoQuery = queryBuilder();
  const itemRepository = {
    createQueryBuilder: jest.fn(() => itemQuery),
    count: jest.fn(),
    findOne: jest.fn(),
  };
  const atributoRepository = {
    createQueryBuilder: jest.fn(() => atributoQuery),
    exist: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOneBy: jest.fn(),
  };
  const nodoRepository = {
    createQueryBuilder: jest.fn(() => nodoQuery),
  };
  const resolver = {
    resolverMuchos: jest.fn(),
    resolver: jest.fn(),
  };
  const service = new AdminTaxonomiaService(
    itemRepository as never,
    atributoRepository as never,
    nodoRepository as never,
    resolver as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resetQuery(itemQuery);
    resetQuery(atributoQuery);
    resetQuery(nodoQuery);
  });

  it('lista arboles paginados y cuenta variantes', async () => {
    const item = {
      id: 'PADRE',
      descripcion: 'Producto padre',
      familia: 'FIL',
      isPadre: true,
      idPadre: null,
    };
    itemQuery.getManyAndCount.mockResolvedValue([[item], 21]);
    itemQuery.getRawMany.mockResolvedValue([{ arbol: 'PADRE', cantidad: '4' }]);
    resolver.resolverMuchos.mockResolvedValue(
      new Map([
        [
          'PADRE',
          {
            atributosEfectivos: [{ atributoId: 'MAT1' }],
            duplicadosDirectos: [],
            nodosInvalidos: [],
          },
        ],
      ]),
    );

    const result = await service.listarArboles({ page: 2, limit: 10 });

    expect(itemQuery.skip).toHaveBeenCalledWith(10);
    expect(itemQuery.take).toHaveBeenCalledWith(10);
    expect(result).toMatchObject({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      data: [{ id: 'PADRE', cantidadVariantes: 4 }],
    });
  });

  it('aplica busqueda por id o descripcion', async () => {
    itemQuery.getManyAndCount.mockResolvedValue([[], 0]);
    resolver.resolverMuchos.mockResolvedValue(new Map());

    await service.listarArboles({ page: 1, limit: 20, search: 'pla 850' });

    expect(itemQuery.andWhere).toHaveBeenCalled();
    expect(itemQuery.setParameters).toHaveBeenCalledWith({
      search: '%pla 850%',
      vacio: '',
    });
  });

  it('detalle conserva directos, heredados, origen y duplicados', async () => {
    itemRepository.findOne.mockResolvedValue({
      id: 'HIJO',
      idPadre: 'PADRE',
      descripcion: 'Variante',
      familia: 'FIL',
      isPadre: false,
    });
    itemRepository.count.mockResolvedValue(0);
    resolver.resolver.mockResolvedValue({
      atributosDirectos: [{ atributoId: 'WEBTEC', arbolOrigen: 'HIJO' }],
      atributosEfectivos: [
        { atributoId: 'WEBTEC', arbolOrigen: 'HIJO', heredado: false },
        { atributoId: 'MAT1', arbolOrigen: 'PADRE', heredado: true },
      ],
      duplicadosDirectos: [{ clase: 'Grupo Web', atributos: [] }],
      duplicadosEfectivos: [],
      nodosInvalidos: [],
    });

    await expect(service.obtenerArbol('HIJO')).resolves.toMatchObject({
      atributosDirectos: [{ atributoId: 'WEBTEC', arbolOrigen: 'HIJO' }],
      atributosEfectivos: [
        { atributoId: 'WEBTEC', heredado: false },
        { atributoId: 'MAT1', arbolOrigen: 'PADRE', heredado: true },
      ],
      inconsistencias: [{ code: 'ATRIBUTO_CLASE_DUPLICADO' }],
    });
  });

  it('crea un atributo mapeando grupoAtributo y subgrupoAtributo', async () => {
    atributoRepository.exist.mockResolvedValue(false);

    await service.crearAtributo({
      id: 'pl85',
      nombre: 'PLA 850',
      clase: 'Material',
      grupoAtributo: 'PLA',
      subgrupoAtributo: '850',
      orden: 10,
    });

    expect(atributoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'PL85',
        grupoAtributo: 'PLA',
        subgrupoAtributo: '850',
        grupo: null,
        subgrupo: null,
      }),
    );
  });

  it('rechaza atributos duplicados', async () => {
    atributoRepository.exist.mockResolvedValue(true);

    await expect(
      service.crearAtributo({ id: 'PL85', nombre: 'PLA', clase: 'Material' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('edita grupo_atributo sin tocar grupo', async () => {
    const atributo = {
      id: 'PL85',
      nombre: 'PLA 850',
      clase: 'Material',
      grupo: 'ERP',
      subgrupo: null,
      grupoAtributo: 'PLA',
      subgrupoAtributo: null,
      orden: 1,
    };
    atributoRepository.findOneBy.mockResolvedValue(atributo);
    itemQuery.getRawOne.mockResolvedValue({
      cantidadArboles: '2',
      cantidadVariantes: '15',
    });

    const result = await service.actualizarAtributo('PL85', {
      subgrupoAtributo: '850',
    });

    expect(atributo.grupo).toBe('ERP');
    expect(atributo.subgrupoAtributo).toBe('850');
    expect(result.impacto).toEqual({
      cantidadArboles: 2,
      cantidadVariantes: 15,
    });
  });

  it('rechaza un PATCH vacio', async () => {
    await expect(service.actualizarAtributo('PL85', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function queryBuilder() {
  const qb: Record<string, jest.Mock> = {
    getManyAndCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };
  for (const method of [
    'select',
    'addSelect',
    'andWhere',
    'where',
    'setParameters',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'groupBy',
    'addGroupBy',
    'leftJoin',
    'distinct',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}

function resetQuery(query: Record<string, jest.Mock>) {
  for (const fn of Object.values(query)) fn.mockClear();
}
