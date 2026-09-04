import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogoProducto,
  CatalogoVariante,
  StkItemService,
} from '../stk-item/stk-item.service';
import { shouldApplyDiscount } from '../pricing/discounts';
import { SeoProductDto } from './seo-product.dto';

@Injectable()
export class SeoService {
  constructor(private readonly stkItemService: StkItemService) {}

  async getProducts(): Promise<SeoProductDto[]> {
    const catalogo = await this.stkItemService.getCatalogo();

    return catalogo
      .map((producto) => this.toSeoProduct(producto))
      .filter((producto): producto is SeoProductDto => producto != null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async getProductBySlug(slug: string): Promise<SeoProductDto> {
    const products = await this.getProducts();
    const product = products.find((p) => p.slug === slug);

    if (!product) {
      throw new NotFoundException(`Producto SEO con slug ${slug} no encontrado`);
    }

    return product;
  }

  private toSeoProduct(producto: CatalogoProducto): SeoProductDto | null {
    const variantesPublicables = producto.variantes.filter((variante) =>
      this.esVariantePublicable(variante),
    );

    if (variantesPublicables.length === 0) {
      return null;
    }

    const variantePrincipal = variantesPublicables[0];
    const precios = variantesPublicables.map((v) =>
      Number(v.precioVtaCotizadoMin),
    );
    const promociones = variantesPublicables
      .filter((variante) =>
        shouldApplyDiscount({ id: variante.id, category: producto.grupo }),
      )
      .map((v) => Number(v.promotionalPrice))
      .filter((precio) => Number.isFinite(precio) && precio > 0);

    return {
      id: producto.key,
      slug: this.buildSlug(producto.nombre, variantePrincipal.id),
      nombre: producto.nombre,
      descripcion: this.buildDescripcion(producto, variantePrincipal),
      fotoUrl: variantePrincipal.fotoUrl as string,
      precio: this.redondear2(Math.min(...precios)),
      precioPromocional:
        promociones.length > 0 ? this.redondear2(Math.min(...promociones)) : null,
      stock: variantesPublicables.reduce(
        (total, variante) => total + variante.stock,
        0,
      ),
      marca: producto.marca ?? '',
      categoria: producto.grupo ?? '',
      subcategoria: producto.subgrupo ?? '',
      moneda: 'ARS',
      updatedAt: this.maxUpdatedAt(variantesPublicables),
    };
  }

  private esVariantePublicable(variante: CatalogoVariante): boolean {
    const precio = Number(variante.precioVtaCotizadoMin);

    return (
      variante.visible === true &&
      Number.isFinite(precio) &&
      precio > 0 &&
      !!variante.fotoUrl
    );
  }

  private buildSlug(nombre: string, id: string): string {
    const base = this.slugify(nombre);
    const suffix = this.slugify(id);
    return [base, suffix].filter(Boolean).join('-');
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildDescripcion(
    producto: CatalogoProducto,
    variantePrincipal: CatalogoVariante,
  ): string {
    return (
      variantePrincipal.observaciones?.trim() ||
      variantePrincipal.descripcion?.trim() ||
      [producto.nombre, producto.grupo, producto.subgrupo]
        .filter(Boolean)
        .join(' - ')
    );
  }

  private maxUpdatedAt(variantes: CatalogoVariante[]): string {
    const times = variantes
      .map((variante) => new Date(variante.updatedAt).getTime())
      .filter((time) => Number.isFinite(time));

    if (times.length === 0) {
      return new Date(0).toISOString();
    }

    return new Date(Math.max(...times)).toISOString();
  }

  private redondear2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
