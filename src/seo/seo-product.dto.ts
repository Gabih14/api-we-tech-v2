export interface SeoProductDto {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  fotoUrl: string;
  precio: number;
  precioPromocional: number | null;
  stock: number;
  marca: string;
  categoria: string;
  subcategoria: string;
  moneda: 'ARS';
  updatedAt: string;
}
