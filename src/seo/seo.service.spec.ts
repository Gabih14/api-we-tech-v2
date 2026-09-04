import { NotFoundException } from '@nestjs/common';
import { CatalogoProducto } from '../stk-item/stk-item.service';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  const getCatalogo = jest.fn();
  let service: SeoService;

  beforeEach(() => {
    getCatalogo.mockReset();
    service = new SeoService({ getCatalogo } as any);
  });

  it('devuelve solo productos con variantes visibles, precio valido e imagen', async () => {
    getCatalogo.mockResolvedValue([
      productoCatalogo({
        key: 'visible',
        nombre: 'PLA Pro Negro',
        variantes: [
          varianteCatalogo({
            id: 'PLA-NEGRO',
            precioVtaCotizadoMin: '12000.50',
            promotionalPrice: '10200.43',
            stock: 3,
          }),
          varianteCatalogo({
            id: 'PLA-AZUL',
            precioVtaCotizadoMin: '13000',
            promotionalPrice: '11050',
            stock: 2,
          }),
        ],
      }),
      productoCatalogo({
        key: 'oculto',
        variantes: [varianteCatalogo({ visible: false })],
      }),
      productoCatalogo({
        key: 'sin-precio',
        variantes: [varianteCatalogo({ precioVtaCotizadoMin: null })],
      }),
      productoCatalogo({
        key: 'sin-foto',
        variantes: [varianteCatalogo({ fotoUrl: null })],
      }),
    ]);

    await expect(service.getProducts()).resolves.toEqual([
      {
        id: 'visible',
        slug: 'pla-pro-negro-pla-negro',
        nombre: 'PLA Pro Negro',
        descripcion: 'PLA Pro Negro 1KG',
        fotoUrl: 'https://cdn.wetech.ar/pla.jpg',
        precio: 12000.5,
        precioPromocional: 10200.43,
        stock: 5,
        marca: 'WeTech',
        categoria: 'FILAMENTO 3D',
        subcategoria: 'PLA',
        moneda: 'ARS',
        updatedAt: '2026-09-03T00:00:00.000Z',
      },
    ]);
  });

  it('busca un producto por slug', async () => {
    getCatalogo.mockResolvedValue([
      productoCatalogo({
        nombre: 'Ácido ABS+',
        variantes: [varianteCatalogo({ id: 'ABS+001' })],
      }),
    ]);

    await expect(service.getProductBySlug('acido-abs-abs-001')).resolves.toMatchObject({
      slug: 'acido-abs-abs-001',
      nombre: 'Ácido ABS+',
    });
  });

  it('devuelve precioPromocional null si la categoria no tiene descuento', async () => {
    getCatalogo.mockResolvedValue([
      productoCatalogo({
        grupo: 'IMPRESORAS',
        variantes: [varianteCatalogo({ promotionalPrice: '8500' })],
      }),
    ]);

    await expect(service.getProducts()).resolves.toMatchObject([
      { precioPromocional: null },
    ]);
  });

  it('devuelve 404 si el slug no existe', async () => {
    getCatalogo.mockResolvedValue([]);

    await expect(service.getProductBySlug('no-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function productoCatalogo(
  overrides: Partial<CatalogoProducto> = {},
): CatalogoProducto {
  return {
    key: 'producto',
    nombre: 'Producto SEO',
    marca: 'WeTech',
    material: 'PLA',
    linea: 'Pro',
    origen: 'Argentina',
    grupo: 'FILAMENTO 3D',
    subgrupo: 'PLA',
    precioDesde: '12000.50',
    atributos: [],
    dimensiones: [],
    variantes: [varianteCatalogo()],
    ...overrides,
  };
}

function varianteCatalogo(overrides = {}) {
  return {
    id: 'PLA-NEGRO',
    descripcion: 'PLA Pro Negro 1KG',
    observaciones: null,
    fotoUrl: 'https://cdn.wetech.ar/pla.jpg',
    precioVtaCotizadoMin: '12000.50',
    invoicePrice: '12000.50',
    promotionalPrice: '10200.43',
    stock: 3,
    updatedAt: '2026-09-03T00:00:00.000Z',
    pesoKg: 1,
    familia: 'FIL',
    visible: true,
    opciones: {},
    atributos: [],
    ...overrides,
  };
}
