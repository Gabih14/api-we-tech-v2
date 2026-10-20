import { AtributosEfectivosService } from './atributos-efectivos.service';

describe('AtributosEfectivosService', () => {
  const query = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn(() => ({
      createQueryBuilder: jest.fn(() => query),
    })),
  };
  const service = new AtributosEfectivosService({ manager } as never);

  beforeEach(() => jest.clearAllMocks());

  it('conserva id y arbol de origen en atributos heredados', async () => {
    query.getRawMany.mockResolvedValue([
      {
        arbolOrigen: 'PADRE',
        camino: 'WEBEST',
        nodoAtributoId: 'WEBEST',
        atributoId: 'WEBEST',
        nombre: 'Estandar',
        clase: 'Grupo Web',
        grupo: null,
        subgrupo: null,
        grupoAtributo: null,
        subgrupoAtributo: null,
        orden: 1,
      },
    ]);

    const result = await service.resolver(
      { id: 'HIJO', idPadre: 'PADRE' },
      manager as never,
    );

    expect(result.atributosEfectivos).toEqual([
      expect.objectContaining({
        atributoId: 'WEBEST',
        arbolOrigen: 'PADRE',
        heredado: true,
      }),
    ]);
  });

  it('la clase directa reemplaza a la heredada sin perder otras clases', async () => {
    query.getRawMany.mockResolvedValue([
      row('HIJO', 'WEBTEC', 'Grupo Web', 'Tecnico'),
      row('PADRE', 'WEBEST', 'Grupo Web', 'Estandar'),
      row('PADRE', 'MARCA', 'Marca', 'Marca padre'),
    ]);

    const result = await service.resolver(
      { id: 'HIJO', idPadre: 'PADRE' },
      manager as never,
    );

    expect(result.atributosEfectivos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ atributoId: 'WEBTEC', heredado: false }),
        expect.objectContaining({ atributoId: 'MARCA', heredado: true }),
      ]),
    );
    expect(result.atributosEfectivos).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ atributoId: 'WEBEST' }),
      ]),
    );
  });

  it('expone duplicados directos y efectivos en vez de elegir uno', async () => {
    query.getRawMany.mockResolvedValue([
      row('ARBOL', 'WEBEST', 'Grupo Web', 'Estandar'),
      row('ARBOL', 'WEBTEC', 'Grupo Web', 'Tecnico'),
      row('ARBOL', 'MAT1', 'Material', 'PLA'),
      row('ARBOL', 'MAT2', 'Material', 'PLA+'),
    ]);

    const result = await service.resolver(
      { id: 'ARBOL', idPadre: null },
      manager as never,
    );

    expect(result.atributosEfectivos).toHaveLength(4);
    expect(result.duplicadosDirectos.map(({ clase }) => clase)).toEqual([
      'Grupo Web',
      'Material',
    ]);
    expect(result.duplicadosEfectivos).toHaveLength(2);
  });

  it('detecta nodos nulos y atributos inexistentes', async () => {
    query.getRawMany.mockResolvedValue([
      {
        ...row('ARBOL', 'SIN-ATR', 'Material', 'x'),
        nodoAtributoId: null,
        atributoId: null,
        clase: null,
      },
      {
        ...row('ARBOL', 'BORRADO', 'Material', 'x'),
        nodoAtributoId: 'BORRADO',
        atributoId: null,
        clase: null,
      },
    ]);

    const result = await service.resolver(
      { id: 'ARBOL', idPadre: null },
      manager as never,
    );

    expect(result.nodosInvalidos.map(({ motivo }) => motivo)).toEqual([
      'ATRIBUTO_NULL',
      'ATRIBUTO_INEXISTENTE',
    ]);
  });
});

function row(arbol: string, id: string, clase: string, nombre: string) {
  return {
    arbolOrigen: arbol,
    camino: id,
    nodoAtributoId: id,
    atributoId: id,
    nombre,
    clase,
    grupo: null,
    subgrupo: null,
    grupoAtributo: null,
    subgrupoAtributo: null,
    orden: 1,
  };
}
