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
      'a0.nombre = :valor0 OR a0.grupo_atributo = :valor0',
    );
    expect(query.andWhere.mock.calls[1][0]).toContain(
      'a1.nombre = :valor1 OR a1.subgrupo_atributo = :valor1',
    );
  });

  it('agrupa la faceta Material y expone Submaterial sin duplicados', async () => {
    const query = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
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
      ]),
    };
    const service = Object.create(StkItemService.prototype) as any;
    service.stkAtributoNodoRepository = {
      createQueryBuilder: jest.fn(() => query),
    };

    await expect(service.getFacetasAtributos()).resolves.toEqual([
      { clase: 'Material', valores: [{ valor: 'PLA', color: null }] },
      { clase: 'Submaterial', valores: [{ valor: 'SILK', color: null }] },
    ]);
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
