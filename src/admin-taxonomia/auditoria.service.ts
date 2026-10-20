import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { AtributosEfectivosService } from './atributos-efectivos.service';
import { CLASES_UNICAS } from './asignaciones.service';
import { AuditSeverity, ListAuditoriaDto } from './dto/list-auditoria.dto';

export interface TaxonomiaAuditIssue {
  severity: AuditSeverity;
  code: string;
  message: string;
  arbol?: string;
  atributoId?: string;
  clase?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(StkItem)
    private readonly itemRepository: Repository<StkItem>,
    @InjectRepository(StkAtributo)
    private readonly atributoRepository: Repository<StkAtributo>,
    @InjectRepository(StkAtributoNodo)
    private readonly nodoRepository: Repository<StkAtributoNodo>,
    private readonly atributosEfectivos: AtributosEfectivosService,
  ) {}

  async auditar(query: ListAuditoriaDto) {
    const issues = await this.recolectarIssues();
    const filtered = issues.filter(
      (issue) =>
        (!query.severity || issue.severity === query.severity) &&
        (!query.code || issue.code === query.code) &&
        (!query.arbol || issue.arbol === query.arbol) &&
        (!query.clase ||
          issue.clase?.toLocaleLowerCase('es') ===
            query.clase.toLocaleLowerCase('es')),
    );
    const severityOrder: Record<AuditSeverity, number> = {
      [AuditSeverity.ERROR]: 0,
      [AuditSeverity.WARNING]: 1,
      [AuditSeverity.INFO]: 2,
    };
    filtered.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        a.code.localeCompare(b.code) ||
        (a.arbol ?? a.atributoId ?? '').localeCompare(
          b.arbol ?? b.atributoId ?? '',
        ),
    );
    const start = (query.page - 1) * query.limit;
    return {
      data: filtered.slice(start, start + query.limit),
      page: query.page,
      limit: query.limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / query.limit),
      summary: {
        error: issues.filter((issue) => issue.severity === AuditSeverity.ERROR)
          .length,
        warning: issues.filter(
          (issue) => issue.severity === AuditSeverity.WARNING,
        ).length,
        info: issues.filter((issue) => issue.severity === AuditSeverity.INFO)
          .length,
      },
    };
  }

  private async recolectarIssues(): Promise<TaxonomiaAuditIssue[]> {
    const [
      duplicados,
      nodosInvalidos,
      padresInvalidos,
      autorreferencias,
      arboles,
      materialesSinGrupo,
      atributosSinUso,
      padresSinVariantes,
      soloHerencia,
    ] = await Promise.all([
      this.buscarDuplicados(),
      this.buscarNodosInvalidos(),
      this.buscarPadresInvalidos(),
      this.itemRepository
        .find({
          where: {},
          select: ['id', 'idPadre'],
        })
        .then((items) => items.filter((item) => item.idPadre === item.id)),
      this.itemRepository
        .createQueryBuilder('i')
        .select(['i.id', 'i.idPadre'])
        .where('i.id_padre IS NULL')
        .getMany(),
      this.atributoRepository
        .createQueryBuilder('a')
        .where('LOWER(TRIM(a.clase)) = LOWER(TRIM(:clase))', {
          clase: 'Material',
        })
        .andWhere(
          '(a.grupo_atributo IS NULL OR TRIM(a.grupo_atributo) = :vacio)',
          { vacio: '' },
        )
        .getMany(),
      this.atributoRepository
        .createQueryBuilder('a')
        .where(
          'NOT EXISTS (SELECT 1 FROM stk_atributo_nodo n WHERE n.atributo = a.id)',
        )
        .getMany(),
      this.itemRepository
        .createQueryBuilder('i')
        .where('i.is_padre = 1')
        .andWhere(
          'NOT EXISTS (SELECT 1 FROM stk_item hijo WHERE hijo.id_padre = i.id)',
        )
        .getMany(),
      this.buscarAtributosSoloHerencia(),
    ]);

    const issues: TaxonomiaAuditIssue[] = [];
    for (const row of duplicados) {
      issues.push({
        severity: AuditSeverity.ERROR,
        code: 'ATRIBUTO_CLASE_DUPLICADO',
        message: `${row.arbol} tiene ${row.cantidad} atributos directos de clase ${row.clase}`,
        arbol: row.arbol,
        clase: row.clase,
        details: { cantidad: Number(row.cantidad), atributos: row.atributos },
      });
    }
    for (const row of nodosInvalidos) {
      const isNull = row.atributoId == null;
      issues.push({
        severity: AuditSeverity.ERROR,
        code: isNull ? 'ATRIBUTO_NULL' : 'ATRIBUTO_INEXISTENTE',
        message: isNull
          ? `El nodo ${row.arbol}/${row.camino} no tiene atributo`
          : `El nodo ${row.arbol}/${row.camino} referencia ${row.atributoId}, que no existe`,
        arbol: row.arbol,
        atributoId: row.atributoId ?? undefined,
        details: { camino: row.camino },
      });
    }
    for (const item of padresInvalidos) {
      issues.push({
        severity: AuditSeverity.ERROR,
        code: 'ID_PADRE_INEXISTENTE',
        message: `${item.id} referencia al padre inexistente ${item.idPadre}`,
        arbol: item.id,
        details: { idPadre: item.idPadre },
      });
    }
    for (const item of autorreferencias) {
      issues.push({
        severity: AuditSeverity.ERROR,
        code: 'AUTORREFERENCIA',
        message: `${item.id} se referencia a si mismo como padre`,
        arbol: item.id,
      });
    }

    const estados = await this.atributosEfectivos.resolverMuchos(arboles);
    for (const item of arboles) {
      const efectivos = estados.get(item.id)?.atributosEfectivos ?? [];
      const porClase = (clase: string) =>
        efectivos.filter(
          (atributo) =>
            this.atributosEfectivos.normalizarClase(atributo.clase) ===
            this.atributosEfectivos.normalizarClase(clase),
        );
      const marca = porClase('Marca');
      const materiales = porClase('Material');
      const grupoWeb = porClase('Grupo Web');
      const sublinea = porClase('Sub-línea');
      if (!marca.length) {
        issues.push(this.warning('ARBOL_SIN_MARCA', item.id, 'Marca'));
      }
      if (!materiales.length) {
        issues.push(this.warning('ARBOL_SIN_MATERIAL', item.id, 'Material'));
      }
      const esPla = materiales.some((material) =>
        (material.grupoAtributo ?? material.nombre ?? '')
          .trim()
          .toUpperCase()
          .startsWith('PLA'),
      );
      if (esPla && !grupoWeb.length) {
        issues.push(this.warning('PLA_SIN_GRUPO_WEB', item.id, 'Grupo Web'));
      }
      if (
        materiales.some((material) => !!material.subgrupoAtributo?.trim()) &&
        !grupoWeb.length
      ) {
        issues.push(
          this.warning(
            'MATERIAL_CON_SUBGRUPO_SIN_GRUPO_WEB',
            item.id,
            'Grupo Web',
          ),
        );
      }
      if (sublinea.length && !marca.length) {
        issues.push(this.warning('SUBLINEA_SIN_MARCA', item.id, 'Sub-línea'));
      }
    }

    for (const atributo of materialesSinGrupo) {
      issues.push({
        severity: AuditSeverity.WARNING,
        code: 'MATERIAL_SIN_GRUPO_ATRIBUTO',
        message: `El Material ${atributo.id} no tiene grupo_atributo`,
        atributoId: atributo.id,
        clase: atributo.clase ?? 'Material',
      });
    }
    for (const atributo of atributosSinUso) {
      issues.push({
        severity: AuditSeverity.INFO,
        code: 'ATRIBUTO_SIN_USO',
        message: `El atributo ${atributo.id} no tiene asociaciones`,
        atributoId: atributo.id,
        clase: atributo.clase ?? undefined,
      });
    }
    for (const item of padresSinVariantes) {
      issues.push({
        severity: AuditSeverity.INFO,
        code: 'PADRE_SIN_VARIANTES',
        message: `El padre ${item.id} no tiene variantes`,
        arbol: item.id,
      });
    }
    for (const atributo of soloHerencia) {
      issues.push({
        severity: AuditSeverity.INFO,
        code: 'ATRIBUTO_SOLO_HERENCIA',
        message: `El atributo ${atributo.id} se asigna solamente a padres`,
        atributoId: atributo.id,
        clase: atributo.clase ?? undefined,
      });
    }
    return issues;
  }

  private async buscarDuplicados() {
    return this.nodoRepository
      .createQueryBuilder('n')
      .innerJoin(StkAtributo, 'a', 'a.id = n.atributo')
      .select('n.arbol', 'arbol')
      .addSelect('MIN(a.clase)', 'clase')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('GROUP_CONCAT(a.id ORDER BY a.id)', 'atributos')
      .where('LOWER(TRIM(a.clase)) IN (:...clases)', {
        clases: CLASES_UNICAS.map((clase) => clase.toLocaleLowerCase('es')),
      })
      .groupBy('n.arbol')
      .addGroupBy('LOWER(TRIM(a.clase))')
      .having('COUNT(*) > 1')
      .getRawMany<{
        arbol: string;
        clase: string;
        cantidad: string;
        atributos: string;
      }>();
  }

  private async buscarNodosInvalidos() {
    return this.nodoRepository
      .createQueryBuilder('n')
      .leftJoin(StkAtributo, 'a', 'a.id = n.atributo')
      .select('n.arbol', 'arbol')
      .addSelect('n.camino', 'camino')
      .addSelect('n.atributo', 'atributoId')
      .where('n.atributo IS NULL OR a.id IS NULL')
      .getRawMany<{
        arbol: string;
        camino: string;
        atributoId: string | null;
      }>();
  }

  private async buscarPadresInvalidos() {
    return this.itemRepository
      .createQueryBuilder('i')
      .leftJoin(StkItem, 'padre', 'padre.id = i.id_padre')
      .select(['i.id', 'i.idPadre'])
      .where('i.id_padre IS NOT NULL')
      .andWhere('padre.id IS NULL')
      .getMany();
  }

  private async buscarAtributosSoloHerencia() {
    return this.atributoRepository
      .createQueryBuilder('a')
      .where(
        `EXISTS (
          SELECT 1 FROM stk_atributo_nodo n
          INNER JOIN stk_item i ON i.id = n.arbol
          WHERE n.atributo = a.id AND i.is_padre = 1
        )`,
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM stk_atributo_nodo n
          INNER JOIN stk_item i ON i.id = n.arbol
          WHERE n.atributo = a.id AND (i.is_padre IS NULL OR i.is_padre = 0)
        )`,
      )
      .getMany();
  }

  private warning(
    code: string,
    arbol: string,
    clase: string,
  ): TaxonomiaAuditIssue {
    return {
      severity: AuditSeverity.WARNING,
      code,
      message: `${arbol}: ${code.toLocaleLowerCase('es').replaceAll('_', ' ')}`,
      arbol,
      clase,
    };
  }
}
