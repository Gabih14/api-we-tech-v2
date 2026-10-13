import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoColorHex } from '../stk-item/entities/stk-atributo-color-hex.entity';
import { StkAtributoArbol } from '../stk-item/entities/stk-atributo-arbol.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { FILAMENT_CATEGORIES } from '../pricing/discounts';
import { AssignColorDto } from './dto/assign-color.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { ColorGroup } from './entities/color-group.entity';
import { Color } from './entities/color.entity';

export interface ColorGroupSummaryResponse {
  id: number;
  name: string;
  hex: string | null;
  sortOrder: number;
}

export interface ColorResponse {
  id: string;
  name: string;
  hex: string;
  hexes: string[];
  order: number | null;
  colorGroupId: number | null;
  colorGroup: ColorGroupSummaryResponse | null;
}

export interface ColorAssignmentResponse {
  itemId: string;
  colors: ColorResponse[];
}

export interface ItemWithoutColorsResponse {
  id: string;
  descripcion: string | null;
}

export type ColorItemResponse = ItemWithoutColorsResponse;

export interface LegacyColorsMigrationResponse {
  linked: number;
  alreadyLinked: number;
  unmatched: Array<{ bridgeId: number; name: string; hex: string | null }>;
}

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(StkAtributo)
    private readonly atributosRepository: Repository<StkAtributo>,
    @InjectRepository(StkAtributoColorHex)
    private readonly colorHexesRepository: Repository<StkAtributoColorHex>,
    @InjectRepository(Color, 'back')
    private readonly colorsBridgeRepository: Repository<Color>,
    @InjectRepository(ColorGroup, 'back')
    private readonly colorGroupsRepository: Repository<ColorGroup>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateColorDto): Promise<ColorResponse> {
    const id = dto.id.trim().toUpperCase();
    const name = dto.name.trim();
    const hexes = this.normalizeHexes(dto.hex, dto.hexes, true);
    const hex = hexes[0];
    if (!name) throw new BadRequestException('name no puede estar vacio');
    await this.ensureColorGroupExists(dto.colorGroupId);

    const duplicate = await this.atributosRepository.findOne({
      where: { id },
    });
    if (duplicate) {
      const bridge = await this.colorsBridgeRepository.findOne({
        where: { stkAtributoId: id },
      });
      if (bridge?.active === false) {
        duplicate.nombre = name;
        duplicate.color = hex;
        duplicate.orden = dto.order ?? null;
        bridge.colorGroupId = dto.colorGroupId ?? null;
        bridge.active = true;
        const [savedColor, savedBridge] = await Promise.all([
          this.atributosRepository.save(duplicate),
          this.colorsBridgeRepository.save(bridge),
        ]);
        await this.replaceHexes(id, hexes);
        return this.toResponse(
          savedColor,
          await this.colorsBridgeRepository.findOneOrFail({
            where: { id: savedBridge.id },
            relations: { colorGroup: true },
          }),
          hexes,
        );
      }
      throw new BadRequestException(`El codigo de color ${id} ya existe`);
    }

    const color = await this.atributosRepository.save(
      this.atributosRepository.create({
        id,
        nombre: name,
        clase: 'Colores',
        color: hex,
        orden: dto.order ?? null,
        grupo: null,
        subgrupo: null,
      }),
    );
    try {
      await this.replaceHexes(id, hexes);
      const bridge = await this.colorsBridgeRepository.save(
        this.colorsBridgeRepository.create({
          stkAtributoId: id,
          colorGroupId: dto.colorGroupId ?? null,
        }),
      );
      return this.toResponse(color, bridge, hexes);
    } catch (error) {
      await this.atributosRepository.delete({ id });
      throw error;
    }
  }

  async findAll(): Promise<ColorResponse[]> {
    const colors = await this.atributosRepository.find({
      where: { clase: 'Colores' },
      order: { orden: 'ASC', nombre: 'ASC' },
    });
    const bridges = await this.colorsBridgeRepository.find({
      relations: { colorGroup: true },
    });
    const bridgeById = new Map(
      bridges
        .filter((bridge) => bridge.stkAtributoId != null)
        .map((bridge) => [bridge.stkAtributoId!, bridge]),
    );
    const hexesById = await this.getHexesByColorIds(colors.map(({ id }) => id));
    return colors
      .filter((color) => bridgeById.get(color.id)?.active !== false)
      .map((color) =>
        this.toResponse(
          color,
          bridgeById.get(color.id),
          hexesById.get(color.id),
        ),
      );
  }

  async deactivate(idParam: string): Promise<ColorResponse> {
    const id = idParam.trim().toUpperCase();
    const color = await this.atributosRepository.findOne({
      where: { id, clase: 'Colores' },
    });
    if (!color) throw new NotFoundException(`Color ${id} no encontrado`);

    let bridge = await this.colorsBridgeRepository.findOne({
      where: { stkAtributoId: id },
      relations: { colorGroup: true },
    });
    if (bridge?.active === false)
      throw new NotFoundException(`Color ${id} no encontrado`);

    bridge ??= this.colorsBridgeRepository.create({ stkAtributoId: id });
    bridge.active = false;
    return this.toResponse(
      color,
      await this.colorsBridgeRepository.save(bridge),
      (await this.getHexesByColorIds([id])).get(id),
    );
  }

  async getColorItems(idParam: string): Promise<ColorItemResponse[]> {
    const id = idParam.trim().toUpperCase();
    const color = await this.atributosRepository.findOne({
      where: { id, clase: 'Colores' },
    });
    if (!color) throw new NotFoundException(`Color ${id} no encontrado`);

    return this.dataSource
      .getRepository(StkItem)
      .createQueryBuilder('i')
      .innerJoin(StkAtributoNodo, 'n', 'n.arbol = i.id AND n.atributo = :id', {
        id,
      })
      .select('i.id', 'id')
      .addSelect('i.descripcion', 'descripcion')
      .where('UPPER(TRIM(i.grupo)) IN (:...filamentGroups)', {
        filamentGroups: [...FILAMENT_CATEGORIES],
      })
      .orderBy('i.descripcion', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .getRawMany<ColorItemResponse>();
  }

  async update(idParam: string, dto: UpdateColorDto): Promise<ColorResponse> {
    const id = idParam.trim().toUpperCase();
    const color = await this.atributosRepository.findOne({
      where: { id, clase: 'Colores' },
    });
    if (!color) throw new NotFoundException(`Color ${id} no encontrado`);
    let bridge = await this.colorsBridgeRepository.findOne({
      where: { stkAtributoId: id },
    });
    if (dto.id !== undefined && dto.id.trim().toUpperCase() !== id) {
      throw new BadRequestException(
        'El codigo de un color existente no se puede cambiar',
      );
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('name no puede estar vacio');
      color.nombre = name;
    }
    let hexes: string[] | undefined;
    if (dto.hexes !== undefined) {
      hexes = this.normalizeHexes(dto.hex, dto.hexes, true);
      color.color = hexes[0];
    } else if (dto.hex !== undefined) {
      const current = (await this.getHexesByColorIds([id])).get(id) ?? [];
      hexes = this.normalizeHexes(
        undefined,
        [dto.hex, ...current.slice(1)],
        true,
      );
      color.color = hexes[0];
    }
    if (dto.order !== undefined) color.orden = dto.order ?? null;
    if (dto.colorGroupId !== undefined) {
      await this.ensureColorGroupExists(dto.colorGroupId);
      bridge ??= this.colorsBridgeRepository.create({ stkAtributoId: id });
      bridge.colorGroupId = dto.colorGroupId ?? null;
      const savedBridge = await this.colorsBridgeRepository.save(bridge);
      bridge = await this.colorsBridgeRepository.findOneOrFail({
        where: { id: savedBridge.id },
        relations: { colorGroup: true },
      });
    } else if (bridge) {
      bridge = await this.colorsBridgeRepository.findOneOrFail({
        where: { id: bridge.id },
        relations: { colorGroup: true },
      });
    }
    const savedColor = await this.atributosRepository.save(color);
    if (hexes) await this.replaceHexes(id, hexes);
    return this.toResponse(
      savedColor,
      bridge,
      hexes ?? (await this.getHexesByColorIds([id])).get(id),
    );
  }

  async getItemColors(itemId: string): Promise<ColorAssignmentResponse> {
    await this.ensureItemExists(itemId);
    const rows = await this.dataSource
      .getRepository(StkAtributoNodo)
      .createQueryBuilder('n')
      .innerJoin(StkAtributo, 'a', 'a.id = n.atributo AND a.clase = :clase', {
        clase: 'Colores',
      })
      .select('a.id', 'id')
      .addSelect('a.nombre', 'name')
      .addSelect('a.color', 'hex')
      .addSelect('a.orden', 'order')
      .where('n.arbol = :itemId', { itemId })
      .orderBy('a.orden', 'ASC')
      .addOrderBy('a.nombre', 'ASC')
      .getRawMany<Pick<ColorResponse, 'id' | 'name' | 'hex' | 'order'>>();
    const bridges = rows.length
      ? await this.colorsBridgeRepository.find({
          where: rows.map((row) => ({ stkAtributoId: row.id })),
          relations: { colorGroup: true },
        })
      : [];
    const bridgeById = new Map(
      bridges
        .filter((bridge) => bridge.stkAtributoId != null)
        .map((bridge) => [bridge.stkAtributoId!, bridge]),
    );
    const hexesById = await this.getHexesByColorIds(rows.map(({ id }) => id));
    return {
      itemId,
      colors: rows.map((row) =>
        this.toResponseFromRaw(
          row,
          bridgeById.get(row.id),
          hexesById.get(row.id),
        ),
      ),
    };
  }

  async getItemsWithoutColors(): Promise<ItemWithoutColorsResponse[]> {
    return this.dataSource
      .getRepository(StkItem)
      .createQueryBuilder('i')
      .select('i.id', 'id')
      .addSelect('i.descripcion', 'descripcion')
      .where(
        `NOT EXISTS (
          SELECT 1
          FROM stk_atributo_nodo n
          INNER JOIN stk_atributo a
            ON a.id = n.atributo
           AND a.clase = :colorClass
          WHERE n.arbol = i.id
        )`,
        { colorClass: 'Colores' },
      )
      .andWhere('UPPER(TRIM(i.grupo)) IN (:...filamentGroups)', {
        filamentGroups: [...FILAMENT_CATEGORIES],
      })
      .orderBy('i.descripcion', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .getRawMany<ItemWithoutColorsResponse>();
  }

  async assignToItem(
    colorIdParam: string,
    itemId: string,
    dto: AssignColorDto,
  ): Promise<ColorAssignmentResponse> {
    const colorId = colorIdParam.trim().toUpperCase();
    await this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(StkItem, {
        where: { id: itemId },
        select: { id: true },
      });
      if (!item) throw new NotFoundException(`Item ${itemId} no encontrado`);
      const color = await manager.findOne(StkAtributo, {
        where: { id: colorId, clase: 'Colores' },
      });
      if (!color) throw new NotFoundException(`Color ${colorId} no encontrado`);
      const bridge = await this.colorsBridgeRepository.findOne({
        where: { stkAtributoId: colorId },
      });
      if (bridge?.active === false)
        throw new NotFoundException(`Color ${colorId} no encontrado`);

      await manager
        .createQueryBuilder()
        .insert()
        .into(StkAtributoArbol)
        .values({ id: itemId, nombre: 'Colores', visible: true })
        .orIgnore()
        .execute();

      if (dto.replaceExisting !== false) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(StkAtributoNodo)
          .where('arbol = :itemId', { itemId })
          .andWhere(
            'atributo IN (SELECT id FROM stk_atributo WHERE clase = :clase)',
            {
              clase: 'Colores',
            },
          )
          .execute();
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into(StkAtributoNodo)
        .values({
          arbol: itemId,
          camino: colorId,
          atributo: colorId,
          atributoPadre: null,
        })
        .orIgnore()
        .execute();
    });
    return this.getItemColors(itemId);
  }

  async unassignFromItem(colorIdParam: string, itemId: string): Promise<void> {
    const colorId = colorIdParam.trim().toUpperCase();
    await this.ensureItemExists(itemId);
    await this.dataSource.getRepository(StkAtributoNodo).delete({
      arbol: itemId,
      atributo: colorId,
    });
  }

  /** Cruza los colores legacy y nativos aun cuando las bases esten en servidores distintos. */
  async migrateLegacyBridges(): Promise<LegacyColorsMigrationResponse> {
    const [bridges, nativeColors] = await Promise.all([
      this.colorsBridgeRepository.find(),
      this.atributosRepository.find({ where: { clase: 'Colores' } }),
    ]);
    const nativeByName = new Map<string, StkAtributo>();
    for (const color of nativeColors) {
      if (color.nombre)
        nativeByName.set(this.normalizeName(color.nombre), color);
    }

    let linked = 0;
    let alreadyLinked = 0;
    const unmatched: LegacyColorsMigrationResponse['unmatched'] = [];
    const usedNativeIds = new Set(
      bridges
        .map((bridge) => bridge.stkAtributoId)
        .filter((id): id is string => id != null),
    );
    for (const bridge of bridges) {
      if (bridge.stkAtributoId) {
        alreadyLinked++;
        continue;
      }
      const name = bridge.legacyName?.trim() ?? '';
      const native = name
        ? nativeByName.get(this.normalizeName(name))
        : undefined;
      if (!native || usedNativeIds.has(native.id)) {
        unmatched.push({ bridgeId: bridge.id, name, hex: bridge.legacyHex });
        continue;
      }
      bridge.stkAtributoId = native.id;
      await this.colorsBridgeRepository.save(bridge);
      usedNativeIds.add(native.id);
      linked++;
    }
    return { linked, alreadyLinked, unmatched };
  }

  async linkLegacyBridge(
    bridgeId: number,
    colorIdParam: string,
  ): Promise<ColorResponse> {
    const colorId = colorIdParam.trim().toUpperCase();
    const [bridge, native] = await Promise.all([
      this.colorsBridgeRepository.findOne({ where: { id: bridgeId } }),
      this.atributosRepository.findOne({
        where: { id: colorId, clase: 'Colores' },
      }),
    ]);
    if (!bridge)
      throw new NotFoundException(`Registro legacy ${bridgeId} no encontrado`);
    if (!native) throw new NotFoundException(`Color ${colorId} no encontrado`);
    const used = await this.colorsBridgeRepository.findOne({
      where: { stkAtributoId: colorId },
    });
    if (used && used.id !== bridgeId) {
      throw new BadRequestException(
        `El color ${colorId} ya esta vinculado al registro ${used.id}`,
      );
    }
    bridge.stkAtributoId = colorId;
    const saved = await this.colorsBridgeRepository.save(bridge);
    const withGroup = await this.colorsBridgeRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { colorGroup: true },
    });
    return this.toResponse(
      native,
      withGroup,
      (await this.getHexesByColorIds([colorId])).get(colorId),
    );
  }

  private async ensureItemExists(itemId: string): Promise<void> {
    const exists = await this.dataSource
      .getRepository(StkItem)
      .exist({ where: { id: itemId } });
    if (!exists) throw new NotFoundException(`Item ${itemId} no encontrado`);
  }

  private async ensureColorGroupExists(
    colorGroupId: number | null | undefined,
  ): Promise<void> {
    if (colorGroupId == null) return;
    const exists = await this.colorGroupsRepository.exist({
      where: { id: colorGroupId },
    });
    if (!exists) {
      throw new BadRequestException(
        `Grupo de color ${colorGroupId} no encontrado`,
      );
    }
  }

  private normalizeName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es');
  }

  private async replaceHexes(colorId: string, hexes: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StkAtributoColorHex, { atributoId: colorId });
      await manager.save(
        StkAtributoColorHex,
        hexes.map((hex, orden) => ({ atributoId: colorId, hex, orden })),
      );
    });
  }

  private async getHexesByColorIds(
    colorIds: string[],
  ): Promise<Map<string, string[]>> {
    if (!colorIds.length) return new Map();
    const rows = await this.colorHexesRepository.find({
      where: { atributoId: In(colorIds) },
      order: { atributoId: 'ASC', orden: 'ASC' },
    });
    const result = new Map<string, string[]>();
    for (const row of rows) {
      const values = result.get(row.atributoId) ?? [];
      values.push(row.hex);
      result.set(row.atributoId, values);
    }
    return result;
  }

  private normalizeHexes(
    hex: string | undefined,
    hexes: string[] | undefined,
    required: boolean,
  ): string[] {
    if (hexes === undefined) {
      if (hex !== undefined) return [hex.trim().toUpperCase()];
      if (required) throw new BadRequestException('hex o hexes es requerido');
      return [];
    }
    const normalized = hexes.map((value) => value.trim().toUpperCase());
    if (required && !normalized.length) {
      throw new BadRequestException('hexes debe contener al menos un color');
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException(
        'hexes no puede contener valores repetidos',
      );
    }
    if (hex !== undefined && hex.trim().toUpperCase() !== normalized[0]) {
      throw new BadRequestException(
        'hex debe coincidir con el primer valor de hexes',
      );
    }
    return normalized;
  }

  private toResponse(
    color: StkAtributo,
    bridge?: Color | null,
    hexes?: string[],
  ): ColorResponse {
    return this.toResponseFromRaw(
      {
        id: color.id,
        name: color.nombre ?? '',
        hex: color.color ?? '',
        order: color.orden,
      },
      bridge,
      hexes,
    );
  }

  private toResponseFromRaw(
    color: Pick<ColorResponse, 'id' | 'name' | 'hex' | 'order'>,
    bridge?: Color | null,
    hexes?: string[],
  ): ColorResponse {
    const group = bridge?.colorGroup;
    return {
      ...color,
      hexes: hexes?.length ? hexes : color.hex ? [color.hex] : [],
      colorGroupId: bridge?.colorGroupId ?? null,
      colorGroup: group
        ? {
            id: group.id,
            name: group.name,
            hex: group.hex,
            sortOrder: group.sortOrder,
          }
        : null,
    };
  }
}
