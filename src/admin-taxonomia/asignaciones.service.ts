import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoArbol } from '../stk-item/entities/stk-atributo-arbol.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import {
  AtributoAdministrativo,
  AtributosEfectivosService,
} from './atributos-efectivos.service';

export const CLASES_UNICAS = [
  'Marca',
  'Material',
  'Grupo Web',
  'Sub-línea',
  'Línea',
  'Peso Neto',
  'Origen',
  'Nivel de Dificultad',
] as const;

export interface PlanAsignacion {
  arbol: string;
  clase: string;
  anterior: AtributoAdministrativo | null;
  anteriores: AtributoAdministrativo[];
  nuevo: {
    id: string;
    nombre: string | null;
    clase: string;
  };
  variantesAfectadas: number;
  duplicadosQueSeEliminarian: AtributoAdministrativo[];
  advertencias: string[];
}

@Injectable()
export class AsignacionesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly atributosEfectivos: AtributosEfectivosService,
  ) {}

  preview(arbol: string, clase: string, atributoId: string) {
    return this.planificar(arbol, clase, atributoId, this.dataSource.manager);
  }

  async reemplazar(arbol: string, clase: string, atributoId: string) {
    const plan = await this.dataSource.transaction(async (manager) => {
      await this.bloquearArbol(arbol, manager);
      const currentPlan = await this.planificar(
        arbol,
        clase,
        atributoId,
        manager,
      );

      await manager
        .createQueryBuilder()
        .insert()
        .into(StkAtributoArbol)
        .values({ id: arbol, nombre: currentPlan.clase, visible: true })
        .orIgnore()
        .execute();
      await this.eliminarClaseDirecta(arbol, currentPlan.clase, manager);
      await manager.getRepository(StkAtributoNodo).insert({
        arbol,
        camino: currentPlan.nuevo.id,
        atributo: currentPlan.nuevo.id,
        atributoPadre: null,
      });
      return currentPlan;
    });

    return {
      ...plan,
      estadoFinal: await this.estadoFinal(arbol),
    };
  }

  async eliminar(arbol: string, clase: string) {
    const resultado = await this.dataSource.transaction(async (manager) => {
      const item = await this.bloquearArbol(arbol, manager);
      const estado = await this.atributosEfectivos.resolver(item, manager);
      const directos = estado.atributosDirectos.filter(
        (atributo) =>
          this.atributosEfectivos.normalizarClase(atributo.clase) ===
          this.atributosEfectivos.normalizarClase(clase),
      );
      await this.eliminarClaseDirecta(arbol, clase, manager);
      return { item, directos };
    });

    const estado = await this.estadoFinal(arbol);
    const efectivos = estado.atributosEfectivos.filter(
      (atributo) =>
        this.atributosEfectivos.normalizarClase(atributo.clase) ===
        this.atributosEfectivos.normalizarClase(clase),
    );
    return {
      arbol,
      clase,
      eliminado: resultado.directos[0]?.atributoId ?? null,
      eliminados: resultado.directos.map((atributo) => atributo.atributoId),
      valorEfectivoActual: efectivos[0] ?? null,
      valoresEfectivosActuales: efectivos,
      estadoFinal: estado,
    };
  }

  private async planificar(
    arbol: string,
    claseParam: string,
    atributoIdParam: string,
    manager: EntityManager,
  ): Promise<PlanAsignacion> {
    const item = await manager.getRepository(StkItem).findOne({
      where: { id: arbol },
      select: ['id', 'idPadre', 'isPadre'],
    });
    if (!item) throw new NotFoundException(`Arbol ${arbol} no encontrado`);

    const atributoId = atributoIdParam.trim().toUpperCase();
    const atributo = await manager
      .getRepository(StkAtributo)
      .findOneBy({ id: atributoId });
    if (!atributo) {
      throw new NotFoundException(`Atributo ${atributoId} no encontrado`);
    }
    if (
      !atributo.clase ||
      this.atributosEfectivos.normalizarClase(atributo.clase) !==
        this.atributosEfectivos.normalizarClase(claseParam)
    ) {
      throw new BadRequestException(
        `El atributo ${atributoId} pertenece a la clase ${atributo.clase ?? '(sin clase)'}, no a ${claseParam}`,
      );
    }

    const clase = atributo.clase;
    const estado = await this.atributosEfectivos.resolver(item, manager);
    const directos = estado.atributosDirectos.filter(
      (value) =>
        this.atributosEfectivos.normalizarClase(value.clase) ===
        this.atributosEfectivos.normalizarClase(clase),
    );
    const efectivos = estado.atributosEfectivos.filter(
      (value) =>
        this.atributosEfectivos.normalizarClase(value.clase) ===
        this.atributosEfectivos.normalizarClase(clase),
    );
    const variantesAfectadas = await this.contarVariantesAfectadas(
      item,
      clase,
      manager,
    );
    const advertencias: string[] = [];
    if (efectivos.length > 1) {
      advertencias.push(
        `El estado efectivo actual contiene ${efectivos.length} atributos de la clase ${clase}`,
      );
    }
    if (item.idPadre) {
      advertencias.push(
        'La asignacion crea o reemplaza un override directo sobre una variante',
      );
    }

    return {
      arbol,
      clase,
      anterior: efectivos[0] ?? null,
      anteriores: efectivos,
      nuevo: { id: atributo.id, nombre: atributo.nombre, clase },
      variantesAfectadas,
      duplicadosQueSeEliminarian: directos.length > 1 ? directos : [],
      advertencias,
    };
  }

  private async bloquearArbol(
    arbol: string,
    manager: EntityManager,
  ): Promise<StkItem> {
    const item = await manager
      .getRepository(StkItem)
      .createQueryBuilder('i')
      .setLock('pessimistic_write')
      .where('i.id = :arbol', { arbol })
      .getOne();
    if (!item) throw new NotFoundException(`Arbol ${arbol} no encontrado`);
    return item;
  }

  private async eliminarClaseDirecta(
    arbol: string,
    clase: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .delete()
      .from(StkAtributoNodo)
      .where('arbol = :arbol', { arbol })
      .andWhere(
        `atributo IN (
          SELECT id FROM stk_atributo
          WHERE LOWER(TRIM(clase)) = LOWER(TRIM(:clase))
        )`,
        { clase },
      )
      .execute();
  }

  private async contarVariantesAfectadas(
    item: Pick<StkItem, 'id' | 'idPadre'>,
    clase: string,
    manager: EntityManager,
  ): Promise<number> {
    if (item.idPadre) return 1;
    return manager
      .getRepository(StkItem)
      .createQueryBuilder('i')
      .where('i.id_padre = :arbol', { arbol: item.id })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM stk_atributo_nodo propio
          INNER JOIN stk_atributo atributo_propio
            ON atributo_propio.id = propio.atributo
          WHERE propio.arbol = i.id
            AND LOWER(TRIM(atributo_propio.clase)) = LOWER(TRIM(:clase))
        )`,
        { clase },
      )
      .getCount();
  }

  private async estadoFinal(arbol: string) {
    const item = await this.dataSource.getRepository(StkItem).findOne({
      where: { id: arbol },
      select: ['id', 'idPadre'],
    });
    if (!item) throw new NotFoundException(`Arbol ${arbol} no encontrado`);
    return this.atributosEfectivos.resolver(item);
  }
}
