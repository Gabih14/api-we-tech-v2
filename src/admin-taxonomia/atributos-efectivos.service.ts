import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

interface AtributoNodoRaw {
  arbolOrigen: string;
  camino: string;
  nodoAtributoId: string | null;
  atributoId: string | null;
  nombre: string | null;
  clase: string | null;
  grupo: string | null;
  subgrupo: string | null;
  grupoAtributo: string | null;
  subgrupoAtributo: string | null;
  orden: number | string | null;
}

export interface AtributoAdministrativo {
  id: string;
  atributoId: string;
  nombre: string | null;
  clase: string;
  grupo: string | null;
  subgrupo: string | null;
  grupoAtributo: string | null;
  subgrupoAtributo: string | null;
  orden: number | null;
  heredado: boolean;
  arbolOrigen: string;
  camino: string;
}

export interface NodoInvalido {
  arbol: string;
  camino: string;
  atributoId: string | null;
  motivo: 'ATRIBUTO_NULL' | 'ATRIBUTO_INEXISTENTE' | 'CLASE_NULL';
}

export interface DuplicadoClase {
  clase: string;
  atributos: AtributoAdministrativo[];
}

export interface EstadoAtributosAdministrativo {
  atributosDirectos: AtributoAdministrativo[];
  atributosEfectivos: AtributoAdministrativo[];
  duplicadosDirectos: DuplicadoClase[];
  duplicadosEfectivos: DuplicadoClase[];
  nodosInvalidos: NodoInvalido[];
}

@Injectable()
export class AtributosEfectivosService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolver(
    item: Pick<StkItem, 'id' | 'idPadre'>,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<EstadoAtributosAdministrativo> {
    const estados = await this.resolverMuchos([item], manager);
    return estados.get(item.id) ?? this.estadoVacio();
  }

  async resolverMuchos(
    items: Array<Pick<StkItem, 'id' | 'idPadre'>>,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, EstadoAtributosAdministrativo>> {
    const resultado = new Map<string, EstadoAtributosAdministrativo>();
    if (!items.length) return resultado;

    const arboles = Array.from(
      new Set(
        items.flatMap((item) =>
          item.idPadre ? [item.id, item.idPadre] : [item.id],
        ),
      ),
    );
    const rows = await manager
      .getRepository(StkAtributoNodo)
      .createQueryBuilder('n')
      .leftJoin(StkAtributo, 'a', 'a.id = n.atributo')
      .select('n.arbol', 'arbolOrigen')
      .addSelect('n.camino', 'camino')
      .addSelect('n.atributo', 'nodoAtributoId')
      .addSelect('a.id', 'atributoId')
      .addSelect('a.nombre', 'nombre')
      .addSelect('a.clase', 'clase')
      .addSelect('a.grupo', 'grupo')
      .addSelect('a.subgrupo', 'subgrupo')
      .addSelect('a.grupo_atributo', 'grupoAtributo')
      .addSelect('a.subgrupo_atributo', 'subgrupoAtributo')
      .addSelect('a.orden', 'orden')
      .where('n.arbol IN (:...arboles)', { arboles })
      .orderBy('n.arbol', 'ASC')
      .addOrderBy('a.orden', 'ASC')
      .addOrderBy('a.clase', 'ASC')
      .addOrderBy('a.id', 'ASC')
      .addOrderBy('n.camino', 'ASC')
      .getRawMany<AtributoNodoRaw>();

    const porArbol = new Map<string, AtributoNodoRaw[]>();
    for (const row of rows) {
      const values = porArbol.get(row.arbolOrigen) ?? [];
      values.push(row);
      porArbol.set(row.arbolOrigen, values);
    }

    for (const item of items) {
      const directRows = porArbol.get(item.id) ?? [];
      const parentRows = item.idPadre ? (porArbol.get(item.idPadre) ?? []) : [];
      resultado.set(
        item.id,
        this.construirEstado(item, directRows, parentRows),
      );
    }
    return resultado;
  }

  private construirEstado(
    item: Pick<StkItem, 'id' | 'idPadre'>,
    directRows: AtributoNodoRaw[],
    parentRows: AtributoNodoRaw[],
  ): EstadoAtributosAdministrativo {
    const nodosInvalidos = [...directRows, ...parentRows]
      .map((row): NodoInvalido | null => {
        if (row.nodoAtributoId == null) {
          return {
            arbol: row.arbolOrigen,
            camino: row.camino,
            atributoId: null,
            motivo: 'ATRIBUTO_NULL',
          };
        }
        if (row.atributoId == null) {
          return {
            arbol: row.arbolOrigen,
            camino: row.camino,
            atributoId: row.nodoAtributoId,
            motivo: 'ATRIBUTO_INEXISTENTE',
          };
        }
        if (row.clase == null || row.clase.trim() === '') {
          return {
            arbol: row.arbolOrigen,
            camino: row.camino,
            atributoId: row.atributoId,
            motivo: 'CLASE_NULL',
          };
        }
        return null;
      })
      .filter((value): value is NodoInvalido => value != null);

    const directos = directRows
      .map((row) => this.toAtributo(row, false))
      .filter((value): value is AtributoAdministrativo => value != null);
    const heredados = parentRows
      .map((row) => this.toAtributo(row, true))
      .filter((value): value is AtributoAdministrativo => value != null);
    const clasesDirectas = new Set(
      directos.map((atributo) => this.normalizarClase(atributo.clase)),
    );
    const efectivos = [
      ...directos,
      ...heredados.filter(
        (atributo) => !clasesDirectas.has(this.normalizarClase(atributo.clase)),
      ),
    ].sort((a, b) => this.compararAtributos(a, b));

    return {
      atributosDirectos: directos.sort((a, b) => this.compararAtributos(a, b)),
      atributosEfectivos: efectivos,
      duplicadosDirectos: this.detectarDuplicados(directos),
      duplicadosEfectivos: this.detectarDuplicados(efectivos),
      nodosInvalidos: nodosInvalidos.filter(
        (nodo) => nodo.arbol === item.id || nodo.arbol === item.idPadre,
      ),
    };
  }

  private toAtributo(
    row: AtributoNodoRaw,
    heredado: boolean,
  ): AtributoAdministrativo | null {
    if (!row.atributoId || !row.clase?.trim()) return null;
    return {
      id: row.atributoId,
      atributoId: row.atributoId,
      nombre: row.nombre,
      clase: row.clase,
      grupo: row.grupo,
      subgrupo: row.subgrupo,
      grupoAtributo: row.grupoAtributo,
      subgrupoAtributo: row.subgrupoAtributo,
      orden: row.orden == null ? null : Number(row.orden),
      heredado,
      arbolOrigen: row.arbolOrigen,
      camino: row.camino,
    };
  }

  private detectarDuplicados(
    atributos: AtributoAdministrativo[],
  ): DuplicadoClase[] {
    const porClase = new Map<string, AtributoAdministrativo[]>();
    for (const atributo of atributos) {
      const key = this.normalizarClase(atributo.clase);
      const values = porClase.get(key) ?? [];
      values.push(atributo);
      porClase.set(key, values);
    }
    return Array.from(porClase.values())
      .filter((values) => values.length > 1)
      .map((values) => ({ clase: values[0].clase, atributos: values }));
  }

  private compararAtributos(
    a: AtributoAdministrativo,
    b: AtributoAdministrativo,
  ): number {
    return (
      (a.orden ?? 0) - (b.orden ?? 0) ||
      a.clase.localeCompare(b.clase) ||
      a.atributoId.localeCompare(b.atributoId) ||
      a.camino.localeCompare(b.camino)
    );
  }

  normalizarClase(clase: string): string {
    return clase.trim().toLocaleLowerCase('es');
  }

  private estadoVacio(): EstadoAtributosAdministrativo {
    return {
      atributosDirectos: [],
      atributosEfectivos: [],
      duplicadosDirectos: [],
      duplicadosEfectivos: [],
      nodosInvalidos: [],
    };
  }
}
