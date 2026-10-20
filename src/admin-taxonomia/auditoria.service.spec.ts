import { AuditoriaService } from './auditoria.service';
import { AuditSeverity } from './dto/list-auditoria.dto';

describe('AuditoriaService', () => {
  it('detecta duplicados, PLA sin Grupo Web y Material sin grupo_atributo', async () => {
    const treeQuery = qbWithMany([{ id: 'ARBOL', idPadre: null }]);
    const parentsQuery = qbWithMany([]);
    const materialQuery = qbWithMany([
      { id: 'MAT1', clase: 'Material', grupoAtributo: null },
    ]);
    const unusedQuery = qbWithMany([]);
    const itemRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(treeQuery)
        .mockReturnValueOnce(parentsQuery),
    };
    const atributoRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(materialQuery)
        .mockReturnValueOnce(unusedQuery),
    };
    const resolver = {
      resolverMuchos: jest.fn().mockResolvedValue(
        new Map([
          [
            'ARBOL',
            {
              atributosEfectivos: [
                {
                  atributoId: 'MAT1',
                  clase: 'Material',
                  nombre: 'PLA+ Flex',
                  grupoAtributo: 'PLA+',
                  subgrupoAtributo: 'FLEX',
                },
              ],
            },
          ],
        ]),
      ),
      normalizarClase: (value: string) => value.toLowerCase(),
    };
    const service = new AuditoriaService(
      itemRepository as never,
      atributoRepository as never,
      {} as never,
      resolver as never,
    );
    jest.spyOn(service as any, 'buscarDuplicados').mockResolvedValue([
      {
        arbol: 'ARBOL',
        clase: 'Grupo Web',
        cantidad: '2',
        atributos: 'WEBEST,WEBTEC',
      },
    ]);
    jest.spyOn(service as any, 'buscarNodosInvalidos').mockResolvedValue([]);
    jest.spyOn(service as any, 'buscarPadresInvalidos').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'buscarAtributosSoloHerencia')
      .mockResolvedValue([]);

    const result = await service.auditar({ page: 1, limit: 100 });
    const codes = result.data.map(({ code }) => code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'ATRIBUTO_CLASE_DUPLICADO',
        'MATERIAL_SIN_GRUPO_ATRIBUTO',
        'PLA_SIN_GRUPO_WEB',
        'MATERIAL_CON_SUBGRUPO_SIN_GRUPO_WEB',
      ]),
    );
  });

  it('filtra por severidad, codigo, arbol y clase con paginacion', async () => {
    const service = new AuditoriaService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service as any, 'recolectarIssues').mockResolvedValue([
      {
        severity: AuditSeverity.WARNING,
        code: 'PLA_SIN_GRUPO_WEB',
        message: 'warning',
        arbol: 'A1',
        clase: 'Grupo Web',
      },
      {
        severity: AuditSeverity.INFO,
        code: 'ATRIBUTO_SIN_USO',
        message: 'info',
        atributoId: 'X',
        clase: 'Material',
      },
    ]);

    await expect(
      service.auditar({
        page: 1,
        limit: 10,
        severity: AuditSeverity.WARNING,
        code: 'PLA_SIN_GRUPO_WEB',
        arbol: 'A1',
        clase: 'grupo web',
      }),
    ).resolves.toMatchObject({
      total: 1,
      data: [{ code: 'PLA_SIN_GRUPO_WEB' }],
      summary: { error: 0, warning: 1, info: 1 },
    });
  });
});

function qbWithMany(values: unknown[]) {
  const qb: Record<string, jest.Mock> = {
    getMany: jest.fn().mockResolvedValue(values),
  };
  for (const method of ['select', 'where', 'andWhere']) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}
