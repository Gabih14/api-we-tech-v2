import { StkItemService } from './stk-item.service';

describe('StkItemService clave de catálogo', () => {
  const claveProducto = (item: object, atributos: object[] = []) =>
    (StkItemService.prototype as any).claveProducto(item, atributos);

  it('mantiene una clave individual para ítems sin padre', () => {
    expect(
      claveProducto({ id: 'ITEM-1', idPadre: null }),
    ).toBe('item:ITEM-1');
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
});
