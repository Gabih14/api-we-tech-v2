import { StkItemService } from './stk-item.service';

describe('StkItemService clave de catálogo', () => {
  const claveProducto = (item: object, atributos: object[] = []) =>
    (StkItemService.prototype as any).claveProducto(item, atributos);

  it('mantiene una clave individual para ítems sin padre', () => {
    expect(
      claveProducto({ id: 'ITEM-1', idPadre: null }),
    ).toBe('item:ITEM-1');
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
    expect(
      claveProducto({ id: 'ITEM-1', idPadre: 'PADRE-ADHESIVOS' }),
    ).toBe('padre:PADRE-ADHESIVOS');
  });

  it('conserva la agrupación por identidad cuando hay atributos cargados', () => {
    const atributos = [
      { clase: 'Marca', valor: 'Bambu Lab' },
      { clase: 'Material', valor: 'Acero endurecido' },
      { clase: 'Línea', valor: 'A1' },
      { clase: 'Origen', valor: 'China' },
    ];

    expect(
      claveProducto(
        { id: 'ITEM-1', idPadre: 'PADRE-BOQUILLAS' },
        atributos,
      ),
    ).toBe('fam|Bambu Lab|Acero endurecido|A1|China');
  });

  it('incluye el precio mayorista cotizado en las variantes', () => {
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
      true,
    );

    expect(producto.variantes[0].wholesalePrice).toBe('80.00');
    expect(producto.wholesalePriceFrom).toBe('80.00');
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
