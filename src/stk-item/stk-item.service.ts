import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StkItem } from './entities/stk-item.entity';
import { StkAtributo } from './entities/stk-atributo.entity';
import { StkAtributoNodo } from './entities/stk-atributo-nodo.entity';
import { CreateStkItemDto } from './dto/create-stk-item.dto';
import { UpdateStkItemDto } from './dto/update-stk-item.dto';
import { StkFamilia } from 'src/stk_familia/entities/stk_familia.entity';
import { StkPrecioService } from 'src/stk-precio/stk-precio.service';
import { PedidoSerieService } from 'src/pedido/pedido-serie.service';

/** Proyección pública de un atributo (nada de la fila entera). */
export interface ItemAtributo {
  clase: string;
  valor: string;
  color: string | null;
  /** true si el valor se hereda del ítem padre (GENERICO), no del ítem propio. */
  heredado: boolean;
  /** Orden de presentación definido en el diccionario. */
  orden: number | null;
}

/** Fila cruda de atributo (ítem + valor) usada internamente para fusionar. */
interface AtributoRaw {
  arbol: string;
  clase: string | null;
  valor: string | null;
  color: string | null;
  orden: number | null;
}

export interface ItemAtributos {
  id: string;
  esPadre: boolean;
  idPadre: string | null;
  atributos: ItemAtributo[];
}

/** Filtros de catálogo basados en Atributos nativos (clase => valor exacto). */
export interface AtributoFiltros {
  material?: string;
  nivel?: string;
  aptoAlimentos?: string;
  marca?: string;
  color?: string;
}

/** Un valor posible dentro de una clase de atributo (para poblar selects). */
export interface AtributoValor {
  valor: string;
  color: string | null;
}

/** Clase de atributo con todos sus valores efectivamente en uso. */
export interface AtributoFaceta {
  clase: string;
  valores: AtributoValor[];
}

/** Una dimensión seleccionable de un producto (lo que varía entre variantes). */
export interface CatalogoDimension {
  clase: string;
  valores: AtributoValor[];
}

/** Un SKU comprable concreto dentro de un producto. */
export interface CatalogoVariante {
  id: string;
  descripcion: string | null;
  observaciones: string | null;
  fotoUrl: string | null;
  /** Precio MINORISTA cotizado (fuente principal de precio en la web). */
  precioVtaCotizadoMin: string | null;
  /** Precio de la lista "MINORISTA CON IVA" cotizado; cae al precio normal si no existe. */
  invoicePrice: string | null;
  /** Precio con el 15% de descuento base de filamentos aplicado. */
  promotionalPrice: string | null;
  /** Stock disponible (cantidad − comprometido, sumado por depósito, mínimo 0). */
  stock: number;
  controla_serie: boolean;
  habilitado_web: boolean;
  stock_disponible: number;
  /** Peso en kg parseado de "Peso Neto" (null si no aplica, ej. "Kit 20 Colores"). */
  pesoKg: number | null;
  /** Código de familia del ERP (lo usa el front para filtros de exclusión). */
  familia: string | null;
  visible: boolean;
  /** Valor elegido por cada dimensión (ej. { "Peso Neto": "1KG", "Colores": "Negro" }). */
  opciones: Record<string, string>;
  atributos: ItemAtributo[];
}

/**
 * Producto "armado": agrupa las variantes que comparten identidad (Marca, Material,
 * Línea, Origen). Los atributos comunes van a nivel producto; los que varían quedan
 * como dimensiones seleccionables (Peso Neto, Color, etc.).
 */
export interface CatalogoProducto {
  key: string;
  nombre: string;
  marca: string | null;
  material: string | null;
  linea: string | null;
  origen: string | null;
  /** Grupo/subgrupo del ERP (ej. "FILAMENTO 3D") para la UI y descuentos del front. */
  grupo: string | null;
  subgrupo: string | null;
  /** Precio mínimo entre las variantes ("desde $..."). */
  precioDesde: string | null;
  atributos: ItemAtributo[];
  dimensiones: CatalogoDimension[];
  variantes: CatalogoVariante[];
}

@Injectable()
export class StkItemService {
  constructor(
    @InjectRepository(StkItem)
    private readonly stkItemRepository: Repository<StkItem>,
    @InjectRepository(StkAtributoNodo)
    private readonly stkAtributoNodoRepository: Repository<StkAtributoNodo>,
    @InjectRepository(StkFamilia)
    private readonly stkFamiliaRepository: Repository<StkFamilia>,

    private readonly stkPrecioService: StkPrecioService,
    private readonly pedidoSerieService: PedidoSerieService,
  ) {}

  async create(createStkItemDto: CreateStkItemDto): Promise<StkItem> {
    const item = this.stkItemRepository.create(createStkItemDto);
    return this.stkItemRepository.save(item);
  }

  async findAll(filtros: AtributoFiltros = {}): Promise<any[]> {
    // Si vienen filtros por atributos, primero resolvemos qué ítems los cumplen.
    const idsFiltrados = await this.filtrarIdsPorAtributos(filtros);
    if (idsFiltrados && idsFiltrados.length === 0) {
      return [];
    }

    const items = await this.stkItemRepository.find({
      where: idsFiltrados ? { id: In(idsFiltrados) } : {},
      relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'], // incluir moneda para decidir cotización
    });

    // Combinás cada item con su precioVtaCotizadoMin (aplica cotización solo si la moneda es DOL)
    const ids = items.map((item) => item.id);
    const [configs, series] = await Promise.all([
      this.pedidoSerieService.configuraciones(ids),
      this.pedidoSerieService.disponibilidadSeries(ids),
    ]);
    return items.map((item) => {
      const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');

      let precioVtaCotizadoMin: string | null = null;
      if (precioMinorista) {
        const precioVta = parseFloat(precioMinorista.precioVta || '0');
        const isDol = precioMinorista?.moneda?.id === 'DOL';
        const cot = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
        if (!isNaN(precioVta) && !isNaN(cot)) {
          precioVtaCotizadoMin = (precioVta * cot).toFixed(2);
        }
      }

      const config = configs.get(item.id);
      const stock = this.stockDisponible(item);
      const controlaSerie = Boolean(config?.controla_serie);
      return {
        ...item,
        fotoUrl: this.extractFotoUrl(item.foto),
        precioVtaCotizadoMin,
        controla_serie: controlaSerie,
        habilitado_web: config?.habilitado_web ?? true,
        stock_disponible: controlaSerie ? Math.min(stock, series.get(item.id) ?? 0) : stock,
      };
    });
  }

  async findOne(id: string, includeAtributos = false): Promise<any> {
    const item = await this.stkItemRepository.findOne({
      where: { id },
      relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
    });

    if (!item) {
      throw new NotFoundException(`Item con id ${id} no encontrado`);
    }

    // Buscar el precio de la lista MINORISTA
    const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');

    let precioVtaCotizadoMin: string | null = null;
    if (precioMinorista) {
      const precioVta = parseFloat(precioMinorista.precioVta || '0');
      const isDol = precioMinorista?.moneda?.id === 'DOL';
      const cot = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
      if (!isNaN(precioVta) && !isNaN(cot)) {
        precioVtaCotizadoMin = (precioVta * cot).toFixed(2);
      }
    }

    // Enriquecemos la ficha con los atributos (badges) solo si se pide, para no
    // agregar una consulta extra al flujo interno (update/remove usan el default).
    const atributos = includeAtributos
      ? await this.fetchAtributos(item.id, item.idPadre)
      : undefined;

    const [configs, series] = await Promise.all([
      this.pedidoSerieService.configuraciones([item.id]),
      this.pedidoSerieService.disponibilidadSeries([item.id]),
    ]);
    const config = configs.get(item.id);
    const stock = this.stockDisponible(item);
    const controlaSerie = Boolean(config?.controla_serie);
    return {
      ...item,
      precioVtaCotizadoMin,
      controla_serie: controlaSerie,
      habilitado_web: config?.habilitado_web ?? true,
      stock_disponible: controlaSerie ? Math.min(stock, series.get(item.id) ?? 0) : stock,
      ...(includeAtributos ? { atributos } : {}),
    };
  }

  /**
   * Ficha técnica de un ítem construida desde los Atributos nativos de Nacional
   * Gestión: fusiona los atributos propios del ítem (Color, Apto Alimentos) con
   * los heredados de su padre GENERICO (Marca, Material, Línea, etc.).
   */
  async getAtributos(id: string): Promise<ItemAtributos> {
    const item = await this.stkItemRepository.findOne({
      where: { id },
      select: ['id', 'isPadre', 'idPadre'],
    });

    if (!item) {
      throw new NotFoundException(`Item con id ${id} no encontrado`);
    }

    return {
      id: item.id,
      esPadre: item.isPadre === true,
      idPadre: item.idPadre,
      atributos: await this.fetchAtributos(item.id, item.idPadre),
    };
  }

  /**
   * Facetas para poblar los selects de filtros: todas las clases de atributo con
   * los valores que están efectivamente asignados a algún ítem (nunca ofrece un
   * valor que daría 0 resultados). Proyección explícita, sin la fila entera.
   */
  async getFacetasAtributos(): Promise<AtributoFaceta[]> {
    const rows = await this.stkAtributoNodoRepository
      .createQueryBuilder('n')
      .innerJoin(StkAtributo, 'a', 'a.id = n.atributo')
      .select('a.clase', 'clase')
      .addSelect('a.nombre', 'valor')
      .addSelect('a.color', 'color')
      .distinct(true)
      .orderBy('a.clase', 'ASC')
      .addOrderBy('a.orden', 'ASC')
      .getRawMany<{ clase: string | null; valor: string | null; color: string | null }>();

    const porClase = new Map<string, AtributoValor[]>();
    for (const r of rows) {
      const clase = r.clase ?? '';
      if (!porClase.has(clase)) porClase.set(clase, []);
      porClase.get(clase)!.push({ valor: r.valor ?? '', color: r.color });
    }

    return Array.from(porClase, ([clase, valores]) => ({ clase, valores }));
  }

  /** Clase de atributo (en el diccionario) para cada clave de filtro. */
  private static readonly CLASE_POR_FILTRO: Record<keyof AtributoFiltros, string> = {
    material: 'Material',
    nivel: 'Nivel de Dificultad',
    aptoAlimentos: 'Apto Alimentos',
    marca: 'Marca',
    color: 'Colores',
  };

  /**
   * Devuelve los ids de ítems que cumplen TODOS los filtros de atributos activos,
   * o `null` si no hay ninguno (para no restringir la búsqueda). Cada filtro es un
   * EXISTS que mira el atributo del propio ítem O el de su padre GENERICO, con la
   * clase filtrada dentro del subquery (evita multiplicar filas).
   */
  private async filtrarIdsPorAtributos(
    filtros: AtributoFiltros,
  ): Promise<string[] | null> {
    const activos = (
      Object.keys(StkItemService.CLASE_POR_FILTRO) as (keyof AtributoFiltros)[]
    )
      .map((key) => ({ clase: StkItemService.CLASE_POR_FILTRO[key], valor: filtros[key] }))
      .filter((f): f is { clase: string; valor: string } => !!f.valor);

    if (activos.length === 0) {
      return null;
    }

    const qb = this.stkItemRepository.createQueryBuilder('i').select('i.id', 'id');

    activos.forEach((f, idx) => {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM stk_atributo_nodo n${idx}
          INNER JOIN stk_atributo a${idx}
            ON a${idx}.id = n${idx}.atributo
           AND a${idx}.clase = :clase${idx}
           AND a${idx}.nombre = :valor${idx}
          WHERE n${idx}.arbol = i.id OR n${idx}.arbol = i.id_padre
        )`,
        { [`clase${idx}`]: f.clase, [`valor${idx}`]: f.valor },
      );
    });

    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /**
   * Trae los atributos del ítem y (si corresponde) los del padre en una sola
   * consulta con proyección explícita — nunca la fila entera. Si una misma clase
   * aparece en el ítem y en el padre, gana el valor propio del ítem.
   */
  private async fetchAtributos(
    itemId: string,
    idPadre: string | null,
  ): Promise<ItemAtributo[]> {
    const qb = this.stkAtributoNodoRepository
      .createQueryBuilder('n')
      .innerJoin(StkAtributo, 'a', 'a.id = n.atributo')
      .select('n.arbol', 'arbol')
      .addSelect('a.clase', 'clase')
      .addSelect('a.nombre', 'valor')
      .addSelect('a.color', 'color')
      .addSelect('a.orden', 'orden')
      .where('n.arbol = :itemId', { itemId });

    if (idPadre) {
      qb.orWhere('n.arbol = :idPadre', { idPadre });
    }

    const rows = await qb.getRawMany<AtributoRaw>();
    return StkItemService.fusionarAtributos(rows, itemId);
  }

  /**
   * Fusiona filas de atributos (propias del ítem + heredadas del padre) en la
   * proyección pública: dedup por clase priorizando el valor propio del ítem,
   * ordenado por `orden`. `itemId` distingue lo propio de lo heredado.
   */
  private static fusionarAtributos(
    rows: AtributoRaw[],
    itemId: string,
  ): ItemAtributo[] {
    const porClase = new Map<string, ItemAtributo>();
    for (const r of rows) {
      const clase = r.clase ?? '';
      const heredado = r.arbol !== itemId;
      const existente = porClase.get(clase);
      if (existente && !existente.heredado) continue; // ya tenemos el propio del ítem
      if (existente && existente.heredado && heredado) continue; // ambos del padre: primero gana
      porClase.set(clase, {
        clase,
        valor: r.valor ?? '',
        color: r.color,
        heredado,
        orden: r.orden,
      });
    }

    return Array.from(porClase.values()).sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
    );
  }

  /**
   * Catálogo "armado" para la web: agrupa las variantes en productos según su
   * identidad (Marca, Material, Línea, Origen) para que desde un producto se pueda
   * elegir peso, color, etc. Los ítems sin padre (sin agrupar) quedan como productos
   * de una sola variante, de modo que el catálogo cubre todos los ítems.
   */
  async getCatalogo(): Promise<CatalogoProducto[]> {
    // Todos los ítems vendibles (excluimos los padres GENERICO, que no se venden).
    const items = (
      await this.stkItemRepository.find({
        relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
      })
    ).filter((i) => !i.isPadre);

    // Atributos de todos los ítems + sus padres en una sola consulta.
    const atributosPorItem = await this.fetchAtributosEnBloque(items);

    // Agrupar por identidad de producto.
    const grupos = new Map<string, StkItem[]>();
    for (const item of items) {
      const key = this.claveProducto(item, atributosPorItem.get(item.id) ?? []);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(item);
    }

    const productos = Array.from(grupos, ([key, variantes]) =>
      this.armarProducto(key, variantes, atributosPorItem),
    );

    const ids = items.map((item) => item.id);
    const [configs, series] = await Promise.all([
      this.pedidoSerieService.configuraciones(ids),
      this.pedidoSerieService.disponibilidadSeries(ids),
    ]);
    for (const producto of productos) {
      for (const variante of producto.variantes) {
        const config = configs.get(variante.id);
        variante.controla_serie = Boolean(config?.controla_serie);
        variante.habilitado_web = config?.habilitado_web ?? true;
        variante.stock_disponible = variante.controla_serie
          ? Math.min(variante.stock, series.get(variante.id) ?? 0)
          : variante.stock;
      }
    }

    return productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Trae los atributos de muchos ítems (y sus padres) en una sola consulta. */
  private async fetchAtributosEnBloque(
    items: StkItem[],
  ): Promise<Map<string, ItemAtributo[]>> {
    const arboles = new Set<string>();
    for (const item of items) {
      arboles.add(item.id);
      if (item.idPadre) arboles.add(item.idPadre);
    }

    const porArbol = new Map<string, AtributoRaw[]>();
    const ids = Array.from(arboles);
    if (ids.length > 0) {
      const rows = await this.stkAtributoNodoRepository
        .createQueryBuilder('n')
        .innerJoin(StkAtributo, 'a', 'a.id = n.atributo')
        .select('n.arbol', 'arbol')
        .addSelect('a.clase', 'clase')
        .addSelect('a.nombre', 'valor')
        .addSelect('a.color', 'color')
        .addSelect('a.orden', 'orden')
        .where('n.arbol IN (:...ids)', { ids })
        .getRawMany<AtributoRaw>();

      for (const r of rows) {
        if (!porArbol.has(r.arbol)) porArbol.set(r.arbol, []);
        porArbol.get(r.arbol)!.push(r);
      }
    }

    const resultado = new Map<string, ItemAtributo[]>();
    for (const item of items) {
      const rows = [
        ...(porArbol.get(item.id) ?? []),
        ...(item.idPadre ? porArbol.get(item.idPadre) ?? [] : []),
      ];
      resultado.set(item.id, StkItemService.fusionarAtributos(rows, item.id));
    }
    return resultado;
  }

  /** Clases que definen la identidad de un producto (lo que NO se elige). */
  private static readonly CLASES_IDENTIDAD = ['Marca', 'Material', 'Línea', 'Origen'];

  /**
   * Clases que nunca son un selector aunque varíen entre variantes: son datos
   * derivados/informativos (ej. Apto Alimentos se deduce del Color). Quedan
   * disponibles a nivel de cada variante (en `atributos`) para mostrarse como badge.
   */
  private static readonly CLASES_NO_SELECCIONABLES = ['Apto Alimentos'];

  /**
   * Clave de agrupación. Los ítems con padre se agrupan por su identidad; los que
   * no tienen padre quedan solos (cada uno es su propio producto).
   */
  private claveProducto(item: StkItem, atributos: ItemAtributo[]): string {
    if (!item.idPadre) return `item:${item.id}`;
    const valor = (clase: string) =>
      atributos.find((a) => a.clase === clase)?.valor ?? '';
    return [
      'fam',
      ...StkItemService.CLASES_IDENTIDAD.map((clase) => valor(clase)),
    ].join('|');
  }

  /** Construye un producto a partir de sus variantes y sus atributos ya fusionados. */
  private armarProducto(
    key: string,
    variantes: StkItem[],
    atributosPorItem: Map<string, ItemAtributo[]>,
  ): CatalogoProducto {
    const atributosDe = (item: StkItem) => atributosPorItem.get(item.id) ?? [];

    // Recolectar, por clase, los valores distintos y en cuántas variantes aparece.
    const info = new Map<
      string,
      {
        valores: Map<string, { color: string | null; orden: number | null }>;
        count: number;
        orden: number;
        heredado: boolean;
      }
    >();
    for (const item of variantes) {
      for (const a of atributosDe(item)) {
        let e = info.get(a.clase);
        if (!e) {
          e = { valores: new Map(), count: 0, orden: a.orden ?? 0, heredado: a.heredado };
          info.set(a.clase, e);
        }
        e.count++;
        e.orden = Math.min(e.orden, a.orden ?? 0);
        if (!e.valores.has(a.valor)) e.valores.set(a.valor, { color: a.color, orden: a.orden });
      }
    }

    const total = variantes.length;
    const compartidos: ItemAtributo[] = [];
    const dimensiones: (CatalogoDimension & { orden: number })[] = [];

    for (const [clase, e] of info) {
      const universal = e.count === total; // presente en todas las variantes
      const constante = e.valores.size === 1;
      if (universal && constante) {
        const [valor, meta] = Array.from(e.valores)[0];
        compartidos.push({ clase, valor, color: meta.color, heredado: e.heredado, orden: e.orden });
      } else if (!StkItemService.CLASES_NO_SELECCIONABLES.includes(clase)) {
        const valores = Array.from(e.valores.entries())
          .sort((a, b) => (a[1].orden ?? 0) - (b[1].orden ?? 0))
          .map(([valor, meta]) => ({ valor, color: meta.color }));
        dimensiones.push({ clase, valores, orden: e.orden });
      }
      // Clases no seleccionables que varían quedan solo en variante.atributos.
    }

    compartidos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    dimensiones.sort((a, b) => a.orden - b.orden);
    const clasesDimension = dimensiones.map((d) => d.clase);

    const variantesOut: CatalogoVariante[] = variantes
      .map((item) => {
        const atributos = atributosDe(item);
        const opciones: Record<string, string> = {};
        for (const clase of clasesDimension) {
          const a = atributos.find((x) => x.clase === clase);
          if (a) opciones[clase] = a.valor;
        }

        const precio = this.precioCotizadoDeLista(item, 'MINORISTA');
        const invoice = this.precioCotizadoDeLista(item, 'MINORISTA CON IVA') ?? precio;
        const promo = precio != null ? precio * 0.85 : null;
        const pesoNeto = atributos.find((x) => x.clase === 'Peso Neto')?.valor;

        return {
          id: item.id,
          descripcion: item.descripcion,
          observaciones: item.observaciones ?? null,
          fotoUrl: this.extractFotoUrl(item.foto),
          precioVtaCotizadoMin: precio != null ? precio.toFixed(2) : null,
          invoicePrice: invoice != null ? invoice.toFixed(2) : null,
          promotionalPrice: promo != null ? promo.toFixed(2) : null,
          stock: this.stockDisponible(item),
          controla_serie: false,
          habilitado_web: true,
          stock_disponible: this.stockDisponible(item),
          pesoKg: StkItemService.pesoAKg(pesoNeto),
          familia: item.familia ?? null,
          visible: !!item.visible,
          opciones,
          atributos,
        };
      })
      .sort((a, b) => (a.descripcion ?? a.id).localeCompare(b.descripcion ?? b.id));

    const valorCompartido = (clase: string) =>
      compartidos.find((a) => a.clase === clase)?.valor ?? null;
    const marca = valorCompartido('Marca');
    const material = valorCompartido('Material');
    const linea = valorCompartido('Línea');
    const origen = valorCompartido('Origen');

    let nombre = [marca, material, linea].filter(Boolean).join(' ');
    if (!nombre) nombre = variantes[0]?.descripcion ?? variantes[0]?.id ?? key;

    const precios = variantesOut
      .map((v) => (v.precioVtaCotizadoMin != null ? parseFloat(v.precioVtaCotizadoMin) : NaN))
      .filter((n) => !isNaN(n));
    const precioDesde = precios.length ? Math.min(...precios).toFixed(2) : null;

    return {
      key,
      nombre,
      marca,
      material,
      linea,
      origen,
      grupo: variantes[0]?.grupo ?? null,
      subgrupo: variantes[0]?.subgrupo ?? null,
      precioDesde,
      atributos: compartidos,
      dimensiones: dimensiones.map(({ orden, ...d }) => d),
      variantes: variantesOut,
    };
  }

  /**
   * Precio de una lista cotizado (aplica cotización solo si la moneda es DOL).
   * Usa `precio_vta` y cae a `precio`. Devuelve `null` si no hay precio válido.
   */
  private precioCotizadoDeLista(item: StkItem, lista: string): number | null {
    const objetivo = lista.trim().toUpperCase();
    const p = item.stkPrecios?.find(
      (x) => (x.lista ?? '').trim().toUpperCase() === objetivo,
    );
    if (!p) return null;
    const base = parseFloat((p.precioVta ?? p.precio ?? '') as string);
    if (!Number.isFinite(base) || base <= 0) return null;
    const cot = p.moneda?.id === 'DOL' ? parseFloat(p.moneda?.cotizacion ?? '1') : 1;
    if (!Number.isFinite(cot)) return null;
    return base * cot;
  }

  /** Stock disponible del ítem: suma de (cantidad − comprometido) por depósito, mínimo 0. */
  private stockDisponible(item: StkItem): number {
    return (item.stkExistencias ?? []).reduce((total, e) => {
      const cantidad = parseFloat(e.cantidad ?? '0');
      const comprometido = parseFloat(e.comprometido ?? '0');
      const disponible = Math.max(
        0,
        (Number.isFinite(cantidad) ? cantidad : 0) -
          (Number.isFinite(comprometido) ? comprometido : 0),
      );
      return total + disponible;
    }, 0);
  }

  /** Convierte un texto de "Peso Neto" (ej. "1KG", "500GR", "2,5KG") a kg numéricos. */
  private static pesoAKg(pesoNeto?: string): number | null {
    if (!pesoNeto) return null;
    const m = pesoNeto.toUpperCase().replace(',', '.').match(/(\d+\.?\d*)\s*(KG|G)/);
    if (!m) return null;
    const valor = parseFloat(m[1]);
    if (!Number.isFinite(valor)) return null;
    return m[2] === 'G' ? valor / 1000 : valor;
  }

  async update(id: string, updateStkItemDto: UpdateStkItemDto): Promise<StkItem> {
    const stkItem = await this.findOne(id); // Verifica si el item existe
  
    if (updateStkItemDto.familiaId) {
      const familia = await this.stkFamiliaRepository.findOne({
        where: { id: updateStkItemDto.familiaId },
      });
  
      if (!familia) {
        throw new NotFoundException(`Familia con id ${updateStkItemDto.familiaId} no encontrada`);
      }
  
      // Asignamos la entidad familia al item
      (stkItem as any).familia = familia;
    }
  
    // Actualizamos el resto de los campos
    Object.assign(stkItem, updateStkItemDto);
  
    return this.stkItemRepository.save(stkItem);
  }
  

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.stkItemRepository.remove(item);
  }

  async getCostoEnvio(distancia: number): Promise<any> {
    // Nueva lógica: tomar el precio del item según la distancia sin cálculos
    // y si no existe ese item, redondear al siguiente más caro (mayor km) si existe.
    const kmInicial = Math.ceil(distancia);

    const findItemForKm = async (km: number) => {
      const id = `ENV-${String(km).padStart(2, '0')}K-GM-DELIVERY`;
      const item = await this.stkItemRepository.findOne({
        where: { id },
        relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
      });
      return { id, item };
    };

    // Intentar con el km inicial y, si no existe, ir subiendo hasta encontrar el siguiente más caro
    let elegidoId = '';
    let elegidoItem: StkItem | null = null;

    // Intento exacto
    const exacto = await findItemForKm(kmInicial);
    if (exacto.item) {
      elegidoId = exacto.id;
      elegidoItem = exacto.item;
    } else {
      // Buscar el siguiente disponible hacia arriba (límite de búsqueda para evitar loops largos)
      const LIMITE_BUSQUEDA = 20;
      for (let delta = 1; delta <= LIMITE_BUSQUEDA; delta++) {
        const siguiente = await findItemForKm(kmInicial + delta);
        if (siguiente.item) {
          elegidoId = siguiente.id;
          elegidoItem = siguiente.item;
          break;
        }
      }
    }

    if (!elegidoItem) {
      throw new NotFoundException(
        `No se encontró item de envío para ${kmInicial}km ni un siguiente más caro disponible`,
      );
    }

    const precioMinorista = elegidoItem.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    if (!precioMinorista) {
      throw new NotFoundException(`Precio MINORISTA no disponible para ${elegidoId}`);
    }

    // Tomar el precio tal cual está definido en el item, sin cálculos adicionales
    const precioVta = parseFloat(precioMinorista.precioVta || '0');
    const isDol = precioMinorista?.moneda?.id === 'DOL';
    const cotizacion = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
    const costoTotal = !isNaN(precioVta) && !isNaN(cotizacion)
      ? parseFloat((precioVta * cotizacion).toFixed(2))
      : precioVta;

    return {
      itemId: elegidoId,
      descripcion: (elegidoItem as any).descripcion,
      lista: 'MINORISTA',
      moneda: precioMinorista?.moneda?.id || null,
      precioVta,
      costoTotal,
    };
  }
  private extractFotoUrl(foto: Buffer | null): string | null {
  if (!foto) return null;

  const text = foto.toString('utf8');
  const match = text.match(/https?:\/\/[^\0]+/);

  return match ? match[0] : null;
}

}
