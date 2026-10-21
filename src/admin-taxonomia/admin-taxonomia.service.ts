import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import {
  AtributosEfectivosService,
  EstadoAtributosAdministrativo,
} from './atributos-efectivos.service';
import { CreateAtributoDto } from './dto/create-atributo.dto';
import { ListArbolesDto, TipoArbol } from './dto/list-arboles.dto';
import { ListAtributosDto } from './dto/list-atributos.dto';
import { UpdateAtributoDto } from './dto/update-atributo.dto';

export interface ImpactoAtributo {
  cantidadArboles: number;
  cantidadVariantes: number;
}

@Injectable()
export class AdminTaxonomiaService {
  constructor(
    @InjectRepository(StkItem)
    private readonly itemRepository: Repository<StkItem>,
    @InjectRepository(StkAtributo)
    private readonly atributoRepository: Repository<StkAtributo>,
    @InjectRepository(StkAtributoNodo)
    private readonly nodoRepository: Repository<StkAtributoNodo>,
    private readonly atributosEfectivos: AtributosEfectivosService,
  ) {}

  async listarArboles(query: ListArbolesDto) {
    const qb = this.itemRepository
      .createQueryBuilder('i')
      .select(['i.id', 'i.descripcion', 'i.familia', 'i.isPadre', 'i.idPadre']);

    if (query.tipo === TipoArbol.PADRE) {
      qb.andWhere('i.is_padre = 1');
    } else if (query.tipo === TipoArbol.STANDALONE) {
      qb.andWhere('i.id_padre IS NULL').andWhere(
        '(i.is_padre IS NULL OR i.is_padre = 0)',
      );
    } else if (query.tipo !== TipoArbol.TODOS) {
      qb.andWhere('i.id_padre IS NULL');
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((search) => {
          search
            .where('LOWER(i.id) LIKE :search')
            .orWhere('LOWER(COALESCE(i.descripcion, :vacio)) LIKE :search');
        }),
      ).setParameters({
        search: `%${query.search.toLowerCase()}%`,
        vacio: '',
      });
    }
    if (query.familia) {
      qb.andWhere('LOWER(TRIM(i.familia)) = :familia', {
        familia: query.familia.toLowerCase(),
      });
    }

    this.aplicarFiltroAtributo(qb, 'marca', 'Marca', query.marca);
    this.aplicarFiltroAtributo(
      qb,
      'material',
      'Material',
      query.material,
      'grupo_atributo',
    );
    this.aplicarFiltroAtributo(
      qb,
      'submaterial',
      'Material',
      query.submaterial,
      'subgrupo_atributo',
    );
    this.aplicarFiltroAtributo(qb, 'grupoWeb', 'Grupo Web', query.grupoWeb);
    this.aplicarFiltroAtributo(qb, 'sublinea', 'Sub-línea', query.sublinea);

    const page = query.page;
    const limit = query.limit;
    const [items, total] = await qb
      .orderBy('i.descripcion', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const [estados, variantes] = await Promise.all([
      this.atributosEfectivos.resolverMuchos(items),
      this.contarVariantes(items.map((item) => item.id)),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        descripcion: item.descripcion,
        familia: item.familia,
        isPadre: item.isPadre === true,
        idPadre: item.idPadre,
        cantidadVariantes: variantes.get(item.id) ?? 0,
        atributos: estados.get(item.id)?.atributosEfectivos ?? [],
        tieneInconsistencias: this.tieneInconsistencias(estados.get(item.id)),
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async obtenerArbol(arbol: string) {
    const item = await this.itemRepository.findOne({
      where: { id: arbol },
      select: ['id', 'descripcion', 'familia', 'isPadre', 'idPadre'],
    });
    if (!item) throw new NotFoundException(`Arbol ${arbol} no encontrado`);

    const [estado, cantidadVariantes] = await Promise.all([
      this.atributosEfectivos.resolver(item),
      this.itemRepository.count({ where: { idPadre: item.id } }),
    ]);
    const inconsistencias = [
      ...estado.duplicadosDirectos.map((duplicado) => ({
        severity: 'error',
        code: 'ATRIBUTO_CLASE_DUPLICADO',
        clase: duplicado.clase,
        atributos: duplicado.atributos.map((atributo) => atributo.atributoId),
      })),
      ...estado.nodosInvalidos.map((nodo) => ({
        severity: 'error',
        code: nodo.motivo,
        camino: nodo.camino,
        atributoId: nodo.atributoId,
        arbolOrigen: nodo.arbol,
      })),
    ];

    return {
      id: item.id,
      descripcion: item.descripcion,
      familia: item.familia,
      isPadre: item.isPadre === true,
      idPadre: item.idPadre,
      cantidadVariantes,
      atributosDirectos: estado.atributosDirectos,
      atributosEfectivos: estado.atributosEfectivos,
      duplicadosDirectos: estado.duplicadosDirectos,
      duplicadosEfectivos: estado.duplicadosEfectivos,
      inconsistencias,
    };
  }

  async listarAtributos(query: ListAtributosDto) {
    const qb = this.atributoRepository.createQueryBuilder('a');
    if (query.search) {
      qb.andWhere(
        new Brackets((search) => {
          search
            .where('LOWER(a.id) LIKE :search')
            .orWhere('LOWER(COALESCE(a.nombre, :vacio)) LIKE :search');
        }),
      ).setParameters({
        search: `%${query.search.toLowerCase()}%`,
        vacio: '',
      });
    }
    if (query.clase) {
      qb.andWhere('LOWER(TRIM(a.clase)) = :clase', {
        clase: query.clase.toLowerCase(),
      });
    }
    if (query.grupoAtributo) {
      qb.andWhere('LOWER(TRIM(a.grupo_atributo)) = :grupoAtributo', {
        grupoAtributo: query.grupoAtributo.toLowerCase(),
      });
    }
    if (query.subgrupoAtributo) {
      qb.andWhere('LOWER(TRIM(a.subgrupo_atributo)) = :subgrupoAtributo', {
        subgrupoAtributo: query.subgrupoAtributo.toLowerCase(),
      });
    }
    if (query.usado !== undefined) {
      qb.andWhere(
        `${query.usado ? '' : 'NOT '}EXISTS (
          SELECT 1 FROM stk_atributo_nodo n WHERE n.atributo = a.id
        )`,
      );
    }

    const { page, limit } = query;
    const [atributos, total] = await qb
      .orderBy('a.clase', 'ASC')
      .addOrderBy('a.orden', 'ASC')
      .addOrderBy('a.nombre', 'ASC')
      .addOrderBy('a.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const usos = await this.contarUsosDirectos(atributos.map(({ id }) => id));

    return {
      data: atributos.map((atributo) => ({
        ...atributo,
        cantidadUsosDirectos: usos.get(atributo.id) ?? 0,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async obtenerAtributo(idParam: string) {
    const id = idParam.trim().toUpperCase();
    const atributo = await this.atributoRepository.findOneBy({ id });
    if (!atributo) {
      throw new NotFoundException(`Atributo ${id} no encontrado`);
    }
    const [arboles, impacto] = await Promise.all([
      this.nodoRepository
        .createQueryBuilder('n')
        .leftJoin(StkItem, 'i', 'i.id = n.arbol')
        .select('n.arbol', 'id')
        .addSelect('i.descripcion', 'descripcion')
        .addSelect('i.is_padre', 'isPadre')
        .where('n.atributo = :id', { id })
        .distinct(true)
        .orderBy('n.arbol', 'ASC')
        .getRawMany<{
          id: string;
          descripcion: string | null;
          isPadre: number;
        }>(),
      this.calcularImpacto(atributo),
    ]);

    return {
      ...atributo,
      usoDirecto: {
        cantidadArboles: arboles.length,
        arboles: arboles.map((arbol) => ({
          ...arbol,
          isPadre: arbol.isPadre === 1,
        })),
      },
      usoEfectivo: impacto,
    };
  }

  async crearAtributo(dto: CreateAtributoDto) {
    const id = dto.id.trim().toUpperCase();
    if (await this.atributoRepository.exist({ where: { id } })) {
      throw new ConflictException(`El atributo ${id} ya existe`);
    }
    const atributo = this.atributoRepository.create({
      id,
      nombre: dto.nombre,
      clase: dto.clase,
      grupoAtributo: dto.grupoAtributo ?? null,
      subgrupoAtributo: dto.subgrupoAtributo ?? null,
      grupo: dto.grupo ?? null,
      subgrupo: dto.subgrupo ?? null,
      orden: dto.orden ?? null,
      color: null,
    });
    return this.atributoRepository.save(atributo);
  }

  async actualizarAtributo(idParam: string, dto: UpdateAtributoDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para actualizar',
      );
    }
    const id = idParam.trim().toUpperCase();
    const atributo = await this.atributoRepository.findOneBy({ id });
    if (!atributo) {
      throw new NotFoundException(`Atributo ${id} no encontrado`);
    }
    const impacto = await this.calcularImpacto(atributo);
    if (dto.nombre !== undefined) atributo.nombre = dto.nombre;
    if (dto.clase !== undefined) atributo.clase = dto.clase;
    if (dto.grupoAtributo !== undefined)
      atributo.grupoAtributo = dto.grupoAtributo;
    if (dto.subgrupoAtributo !== undefined)
      atributo.subgrupoAtributo = dto.subgrupoAtributo;
    if (dto.grupo !== undefined) atributo.grupo = dto.grupo;
    if (dto.subgrupo !== undefined) atributo.subgrupo = dto.subgrupo;
    if (dto.orden !== undefined) atributo.orden = dto.orden;

    return {
      atributo: await this.atributoRepository.save(atributo),
      impacto,
    };
  }

  async calcularImpacto(atributo: Pick<StkAtributo, 'id' | 'clase'>) {
    const clase = atributo.clase ?? '';
    const row = await this.itemRepository
      .createQueryBuilder('i')
      .select(
        'COUNT(DISTINCT CASE WHEN i.id_padre IS NULL THEN i.id ELSE i.id_padre END)',
        'cantidadArboles',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN i.id_padre IS NOT NULL THEN i.id END)',
        'cantidadVariantes',
      )
      .where(
        `EXISTS (
          SELECT 1 FROM stk_atributo_nodo directo
          WHERE directo.arbol = i.id AND directo.atributo = :atributoId
        ) OR (
          i.id_padre IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM stk_atributo_nodo heredado
            WHERE heredado.arbol = i.id_padre
              AND heredado.atributo = :atributoId
          )
          AND NOT EXISTS (
            SELECT 1
            FROM stk_atributo_nodo propio
            INNER JOIN stk_atributo atributo_propio
              ON atributo_propio.id = propio.atributo
            WHERE propio.arbol = i.id
              AND LOWER(TRIM(atributo_propio.clase)) = LOWER(TRIM(:clase))
          )
        )`,
        { atributoId: atributo.id, clase },
      )
      .getRawOne<{ cantidadArboles: string; cantidadVariantes: string }>();
    return {
      cantidadArboles: Number(row?.cantidadArboles ?? 0),
      cantidadVariantes: Number(row?.cantidadVariantes ?? 0),
    } satisfies ImpactoAtributo;
  }

  private aplicarFiltroAtributo(
    qb: SelectQueryBuilder<StkItem>,
    key: string,
    clase: string,
    value?: string,
    classificationColumn?: 'grupo_atributo' | 'subgrupo_atributo',
  ): void {
    if (!value) return;
    const valueMatch = classificationColumn
      ? `(LOWER(TRIM(a_${key}.nombre)) = :${key} OR LOWER(TRIM(a_${key}.${classificationColumn})) = :${key})`
      : `LOWER(TRIM(a_${key}.nombre)) = :${key}`;
    qb.andWhere(
      `EXISTS (
        SELECT 1
        FROM stk_atributo_nodo n_${key}
        INNER JOIN stk_atributo a_${key}
          ON a_${key}.id = n_${key}.atributo
         AND LOWER(TRIM(a_${key}.clase)) = LOWER(TRIM(:clase_${key}))
         AND ${valueMatch}
        WHERE n_${key}.arbol = i.id
           OR (
             n_${key}.arbol = i.id_padre
             AND NOT EXISTS (
               SELECT 1
               FROM stk_atributo_nodo propio_${key}
               INNER JOIN stk_atributo atributo_propio_${key}
                 ON atributo_propio_${key}.id = propio_${key}.atributo
                AND LOWER(TRIM(atributo_propio_${key}.clase)) = LOWER(TRIM(:clase_${key}))
               WHERE propio_${key}.arbol = i.id
             )
           )
      )`,
      {
        [`clase_${key}`]: clase,
        [key]: value.toLowerCase(),
      },
    );
  }

  private async contarVariantes(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.itemRepository
      .createQueryBuilder('i')
      .select('i.id_padre', 'arbol')
      .addSelect('COUNT(*)', 'cantidad')
      .where('i.id_padre IN (:...ids)', { ids })
      .groupBy('i.id_padre')
      .getRawMany<{ arbol: string; cantidad: string }>();
    return new Map(rows.map((row) => [row.arbol, Number(row.cantidad)]));
  }

  private async contarUsosDirectos(
    ids: string[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.nodoRepository
      .createQueryBuilder('n')
      .select('n.atributo', 'atributoId')
      .addSelect('COUNT(DISTINCT n.arbol)', 'cantidad')
      .where('n.atributo IN (:...ids)', { ids })
      .groupBy('n.atributo')
      .getRawMany<{ atributoId: string; cantidad: string }>();
    return new Map(rows.map((row) => [row.atributoId, Number(row.cantidad)]));
  }

  private tieneInconsistencias(
    estado: EstadoAtributosAdministrativo | undefined,
  ): boolean {
    return !!(
      estado &&
      (estado.duplicadosDirectos.length || estado.nodosInvalidos.length)
    );
  }
}
