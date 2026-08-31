import { StkItemService } from './stk-item.service';

describe('StkItemService stock disponible', () => {
  it('suma cantidad sin volver a descontar comprometido', () => {
    const item = {
      stkExistencias: [
        { cantidad: '3', comprometido: '2' },
        { cantidad: '1', comprometido: '5' },
      ],
    };

    const stock = (StkItemService.prototype as any).stockDisponible(item);

    expect(stock).toBe(4);
  });

  it('no publica existencias negativas', () => {
    const item = {
      stkExistencias: [{ cantidad: '-2', comprometido: '0' }],
    };

    const stock = (StkItemService.prototype as any).stockDisponible(item);

    expect(stock).toBe(0);
  });
});
