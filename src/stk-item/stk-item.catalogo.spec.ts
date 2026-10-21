import { StkItemService } from './stk-item.service';

describe('StkItemService clave de catálogo', () => {
  const claveProducto = (item: object, atributos: object[] = []) =>
    (StkItemService.prototype as any).claveProducto(item, atributos);

  it('mantiene una clave individual para ítems sin padre', () => {
    expect(claveProducto({ id: 'ITEM-1', idPadre: null })).toBe('item:ITEM-1');
  });

  it('mantiene separados los complementos aunque compartan padre', () => {
    expect(
      claveProducto({
        id: 'ADH-CIANO-B100',
        idPadre: 'ADH-CIANO-GENE',
        grupo: 'COMPLEMENTOS PARA IMPRESION 3D',
      }),
    ).toBe('item:ADH-CIANO-B100');
  });

  it('usa el padre cuando faltan todos los atributos de identidad', () => {
    expect(claveProducto({ id: 'ITEM-1', idPadre: 'PADRE-ADHESIVOS' })).toBe(
      'padre:PADRE-ADHESIVOS',
    );
  });

  it('conserva la agrupación por identidad cuando hay atributos cargados', () => {
    const atributos = [
      { clase: 'Marca', valor: 'Bambu Lab' },
      { clase: 'Material', valor: 'Acero endurecido' },
      { clase: 'Línea', valor: 'A1' },
      { clase: 'Origen', valor: 'China' },
    ];

    expect(
      claveProducto({ id: 'ITEM-1', idPadre: 'PADRE-BOQUILLAS' }, atributos),
    ).toBe('fam|Bambu Lab|Acero endurecido|A1|China');
  });

  it('conserva valor histórico y clasificación al fusionar atributos', () => {
    const fusionar = (StkItemService as any).fusionarAtributos;
    const atributos = fusionar(
      [
        {
          arbol: 'PADRE',
          clase: 'Material',
          valor: 'PLA Boutique',
          grupoAtributo: 'PLA',
          subgrupoAtributo: null,
          color: null,
          orden: 2,
        },
        {
          arbol: 'ITEM-1',
          clase: 'Sub-línea',
          valor: 'Boutique',
          grupoAtributo: 'GRILON3',
          subgrupoAtributo: 'BOUTIQUE',
          color: null,
          orden: 1,
        },
      ],
      'ITEM-1',
    );

    expect(atributos).toEqual([
      expect.objectContaining({
        clase: 'Sub-línea',
        valor: 'Boutique',
        grupoAtributo: 'GRILON3',
        subgrupoAtributo: 'BOUTIQUE',
        heredado: false,
      }),
      expect.objectContaining({
        clase: 'Material',
        valor: 'PLA Boutique',
        grupoAtributo: 'PLA',
        subgrupoAtributo: null,
        heredado: true,
      }),
    ]);
  });

  it('filtra material por nombre histórico o grupo y submaterial por subgrupo', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const service = Object.create(StkItemService.prototype) as any;
    service.stkItemRepository = { createQueryBuilder: jest.fn(() => query) };

    await service.filtrarIdsPorAtributos({
      material: 'PLA',
      submaterial: 'SILK',
    });

    expect(query.andWhere.mock.calls[0][0]).toContain(
      'LOWER(TRIM(a0.nombre)) = :valor0 OR LOWER(TRIM(a0.grupo_atributo)) = :valor0',
    );
    expect(query.andWhere.mock.calls[1][0]).toContain(
      'LOWER(TRIM(a1.nombre)) = :valor1 OR LOWER(TRIM(a1.subgrupo_atributo)) = :valor1',
    );
    expect(query.andWhere.mock.calls[0][0]).toContain('AND NOT EXISTS');
    expect(query.andWhere.mock.calls[0][1]).toEqual(
      expect.objectContaining({ valor0: 'pla' }),
    );
  });

  it('hereda Grupo Web del padre y conserva la representación genérica', () => {
    const fusionar = (StkItemService as any).fusionarAtributos;

    expect(
      fusionar(
        [
          {
            arbol: 'G3-ASTR-1KG-GENE',
            clase: 'Grupo Web',
            valor: 'Decorativo',
            grupoAtributo: null,
            subgrupoAtributo: null,
            color: null,
            orden: 1,
          },
        ],
        'G3-ASTR-1KG-ROJO',
      ),
    ).toEqual([
      expect.objectContaining({
        clase: 'Grupo Web',
        valor: 'Decorativo',
        heredado: true,
      }),
    ]);
  });

  it('combina marca, sublínea, material, submaterial y Grupo Web', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 'ITEM-1' }]),
    };
    const service = Object.create(StkItemService.prototype) as any;
    service.stkItemRepository = { createQueryBuilder: jest.fn(() => query) };

    await expect(
      service.filtrarIdsPorAtributos({
        marca: 'Hellbot',
        sublinea: 'Ecofila',
        material: 'PLA',
        submaterial: 'SILK',
        grupoWeb: 'DECORATIVO',
      }),
    ).resolves.toEqual(['ITEM-1']);

    expect(query.andWhere).toHaveBeenCalledTimes(5);
    expect(query.andWhere.mock.calls.map((call) => call[1])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clase0: 'Material', valor0: 'pla' }),
        expect.objectContaining({ clase1: 'Material', valor1: 'silk' }),
        expect.objectContaining({
          clase2: 'Sub-línea',
          valor2: 'ecofila',
        }),
        expect.objectContaining({
          clase3: 'Grupo Web',
          valor3: 'decorativo',
        }),
        expect.objectContaining({ clase4: 'Marca', valor4: 'hellbot' }),
      ]),
    );
  });

  it('expone Grupo Web y la taxonomía de Material sin perder el nombre histórico', () => {
    const armarProducto = (StkItemService.prototype as any).armarProducto;
    const item = {
      id: 'ITEM-1',
      idPadre: 'PADRE',
      descripcion: 'PLA Silk rojo',
      stkPrecios: [],
      stkExistencias: [],
    };
    const atributos = [
      {
        clase: 'Material',
        valor: 'PLA Silk',
        grupoAtributo: 'PLA',
        subgrupoAtributo: 'SILK',
        color: null,
        heredado: true,
        orden: 1,
      },
      {
        clase: 'Grupo Web',
        valor: 'Decorativo',
        grupoAtributo: null,
        subgrupoAtributo: null,
        color: null,
        heredado: true,
        orden: 2,
      },
    ];

    const producto = armarProducto.call(
      Object.create(StkItemService.prototype),
      'fam||PLA Silk||',
      [item],
      new Map([['ITEM-1', atributos]]),
    );

    expect(producto).toEqual(
      expect.objectContaining({
        grupoWeb: 'Decorativo',
        material: 'PLA Silk',
        materialGrupo: 'PLA',
        submaterial: 'SILK',
      }),
    );
    expect(producto.atributos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clase: 'Grupo Web',
          valor: 'Decorativo',
        }),
      ]),
    );
  });

  it.each([
    [null, 'Grilon3 Boutique PLA'],
    ['SILK', 'Grilon3 Boutique PLA SILK'],
  ])('arma el nombre del filamento con submaterial %s', (submaterial, nombre) => {
    const armarProducto = (StkItemService.prototype as any).armarProducto;
    const item = {
      id: 'G3-BOUT-ROJO',
      idPadre: 'G3-BOUT-GENE',
      descripcion: 'Filamento PLA Boutique rojo',
      grupo: 'FILAMENTO 3D',
      stkPrecios: [],
      stkExistencias: [],
    };
    const atributo = (
      clase: string,
      valor: string,
      grupoAtributo: string | null = null,
      subgrupoAtributo: string | null = null,
    ) => ({
      clase,
      valor,
      grupoAtributo,
      subgrupoAtributo,
      color: null,
      heredado: true,
      orden: 1,
    });

    const producto = armarProducto.call(
      Object.create(StkItemService.prototype),
      'filamento',
      [item],
      new Map([
        [
          item.id,
          [
            atributo('Marca', 'Grilon3'),
            atributo('Sub-línea', 'Boutique'),
            atributo('Material', 'PLA Boutique', 'PLA', submaterial),
          ],
        ],
      ]),
    );

    expect(producto.nombre).toBe(nombre);
    expect(producto.material).toBe('PLA Boutique');
    expect(producto.materialGrupo).toBe('PLA');
  });

  it('agrupa la faceta Material y expone Submaterial sin duplicados', async () => {
    const query = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          clase: 'Material',
          valor: 'PLA Silk',
          grupoAtributo: 'PLA',
          subgrupoAtributo: 'SILK',
          color: null,
        },
        {
          clase: 'Material',
          valor: 'PLA Boutique',
          grupoAtributo: 'PLA',
          subgrupoAtributo: null,
          color: null,
        },
        {
          clase: 'Grupo Web',
          valor: 'Decorativo',
          grupoAtributo: null,
          subgrupoAtributo: null,
          color: null,
        },
      ]),
    };
    const service = Object.create(StkItemService.prototype) as any;
    service.stkAtributoNodoRepository = {
      createQueryBuilder: jest.fn(() => query),
    };

    await expect(service.getFacetasAtributos()).resolves.toEqual([
      { clase: 'Material', valores: [{ valor: 'PLA', color: null }] },
      { clase: 'Submaterial', valores: [{ valor: 'SILK', color: null }] },
      {
        clase: 'Grupo Web',
        valores: [{ valor: 'Decorativo', color: null }],
      },
    ]);
    expect(query.where).toHaveBeenCalledWith(
      '(i.is_padre IS NULL OR i.is_padre = 0)',
    );
    expect(query.andWhere.mock.calls[0][0]).toContain('NOT EXISTS');
    expect(query.andWhere.mock.calls[0][0]).toContain(
      `ON atributo_propio.id = propio.atributo
          WHERE propio.arbol = i.id
            AND LOWER(TRIM(atributo_propio.clase)) = LOWER(TRIM(a.clase))`,
    );
  });

  it('incluye el precio mayorista cotizado en las variantes', () => {
    const armarProducto = (StkItemService.prototype as any).armarProducto;
    const item = {
      id: 'ITEM-1',
      idPadre: null,
      descripcion: 'Producto',
      grupo: 'FILAMENTOS',
      stkPrecios: [
        { lista: 'MINORISTA', precioVta: '100', moneda: { id: 'PES' } },
        { lista: 'MAYORISTA', precioVta: '80', moneda: { id: 'PES' } },
      ],
      stkExistencias: [],
    };

    const producto = armarProducto.call(
      Object.create(StkItemService.prototype),
      'item:ITEM-1',
      [item],
      new Map([['ITEM-1', []]]),
      true,
    );

    expect(producto.variantes[0].wholesalePrice).toBe('80.00');
    expect(producto.wholesalePriceFrom).toBe('80.00');
  });

  it('no expone precios mayoristas para productos que no son filamentos', () => {
    const armarProducto = (StkItemService.prototype as any).armarProducto;
    const item = {
      id: 'ITEM-1',
      idPadre: null,
      descripcion: 'Impresora',
      grupo: 'IMPRESORAS 3D',
      stkPrecios: [
        { lista: 'MINORISTA', precioVta: '100', moneda: { id: 'PES' } },
        { lista: 'MAYORISTA', precioVta: '80', moneda: { id: 'PES' } },
      ],
      stkExistencias: [],
    };

    const producto = armarProducto.call(
      Object.create(StkItemService.prototype),
      'item:ITEM-1',
      [item],
      new Map([['ITEM-1', []]]),
      true,
    );

    expect(producto.variantes[0]).not.toHaveProperty('wholesalePrice');
    expect(producto).not.toHaveProperty('wholesalePriceFrom');
  });

  it('no expone precios mayoristas en el catálogo normal', () => {
    const armarProducto = (StkItemService.prototype as any).armarProducto;
    const item = {
      id: 'ITEM-1',
      idPadre: null,
      descripcion: 'Producto',
      stkPrecios: [
        { lista: 'MINORISTA', precioVta: '100', moneda: { id: 'PES' } },
        { lista: 'MAYORISTA', precioVta: '80', moneda: { id: 'PES' } },
      ],
      stkExistencias: [],
    };

    const producto = armarProducto.call(
      Object.create(StkItemService.prototype),
      'item:ITEM-1',
      [item],
      new Map([['ITEM-1', []]]),
    );

    expect(producto.variantes[0]).not.toHaveProperty('wholesalePrice');
    expect(producto).not.toHaveProperty('wholesalePriceFrom');
  });
});
