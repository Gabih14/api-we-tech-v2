import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { ListStkAtributoDto } from './dto/list-stk-atributo.dto';
import { UpdateStkAtributoClasificacionDto } from './dto/update-stk-atributo-clasificacion.dto';

@Injectable()
export class StkAtributoService {
  constructor(
    @InjectRepository(StkAtributo)
    private readonly repository: Repository<StkAtributo>,
  ) {}

  findAll(filters: ListStkAtributoDto): Promise<StkAtributo[]> {
    const query = this.repository.createQueryBuilder('atributo');

    if (filters.sinGrupo) {
      query.andWhere(
        '(atributo.grupo IS NULL OR TRIM(atributo.grupo) = :grupoVacio)',
        { grupoVacio: '' },
      );
    }
    if (filters.sinSubgrupo) {
      query.andWhere(
        '(atributo.subgrupo IS NULL OR TRIM(atributo.subgrupo) = :subgrupoVacio)',
        { subgrupoVacio: '' },
      );
    }
    if (filters.grupo) {
      query.andWhere('atributo.grupo = :grupo', { grupo: filters.grupo });
    }
    if (filters.subgrupo) {
      query.andWhere('atributo.subgrupo = :subgrupo', {
        subgrupo: filters.subgrupo,
      });
    }

    return query
      .orderBy('atributo.clase', 'ASC')
      .addOrderBy('atributo.orden', 'ASC')
      .addOrderBy('atributo.nombre', 'ASC')
      .getMany();
  }

  async findGrupos(): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('atributo')
      .select('TRIM(atributo.grupo)', 'grupo')
      .where('atributo.grupo IS NOT NULL')
      .andWhere('TRIM(atributo.grupo) <> :vacio', { vacio: '' })
      .distinct(true)
      .orderBy('TRIM(atributo.grupo)', 'ASC')
      .getRawMany<{ grupo: string }>();

    return rows.map(({ grupo }) => grupo);
  }

  async findSubgrupos(grupo: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('atributo')
      .select('TRIM(atributo.subgrupo)', 'subgrupo')
      .where('atributo.grupo = :grupo', { grupo })
      .andWhere('atributo.subgrupo IS NOT NULL')
      .andWhere('TRIM(atributo.subgrupo) <> :vacio', { vacio: '' })
      .distinct(true)
      .orderBy('TRIM(atributo.subgrupo)', 'ASC')
      .getRawMany<{ subgrupo: string }>();

    return rows.map(({ subgrupo }) => subgrupo);
  }

  async updateClasificacion(
    id: string,
    dto: UpdateStkAtributoClasificacionDto,
  ): Promise<StkAtributo> {
    const atributo = await this.repository.findOneBy({ id });
    if (!atributo) {
      throw new NotFoundException(`Atributo con id ${id} no encontrado`);
    }

    const clasificacion: Pick<StkAtributo, 'grupo' | 'subgrupo'> = {
      grupo: dto.grupo === undefined ? atributo.grupo : dto.grupo,
      subgrupo: dto.subgrupo === undefined ? atributo.subgrupo : dto.subgrupo,
    };

    await this.repository.update({ id }, clasificacion);
    return { ...atributo, ...clasificacion };
  }
}
