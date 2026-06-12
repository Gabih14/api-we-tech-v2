import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
  id: number;
  name: string;
  hex: string;
  colorGroupId: number | null;
  colorGroup?: ColorGroupSummaryResponse | null;
}

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color, 'back')
    private readonly colorsRepository: Repository<Color>,
    @InjectRepository(ColorGroup, 'back')
    private readonly colorGroupsRepository: Repository<ColorGroup>,
  ) {}

  async create(createColorDto: CreateColorDto): Promise<ColorResponse> {
    const name = createColorDto.name.trim();
    const hex = createColorDto.hex.trim().toUpperCase();

    if (!name) {
      throw new BadRequestException('name no puede estar vacio');
    }

    const existingColor = await this.colorsRepository.findOne({
      where: { name },
    });

    if (existingColor) {
      throw new BadRequestException(`El color ${name} ya existe`);
    }

    await this.ensureColorGroupExists(createColorDto.colorGroupId);

    const color = await this.colorsRepository.save(
      this.colorsRepository.create({
        name,
        hex,
        colorGroupId: createColorDto.colorGroupId ?? null,
      }),
    );

    return this.toResponse(color);
  }

  async findAll(): Promise<ColorResponse[]> {
    const colors = await this.colorsRepository.find({
      relations: { colorGroup: true },
      order: { name: 'ASC' },
    });

    return colors.map((color) => this.toResponse(color));
  }

  async update(
    id: number,
    updateColorDto: UpdateColorDto,
  ): Promise<ColorResponse> {
    const color = await this.colorsRepository.findOne({ where: { id } });

    if (!color) {
      throw new NotFoundException(`Color ${id} no encontrado`);
    }

    if (updateColorDto.name !== undefined) {
      const name = updateColorDto.name.trim();

      if (!name) {
        throw new BadRequestException('name no puede estar vacio');
      }

      const existingColor = await this.colorsRepository.findOne({
        where: { name, id: Not(id) },
      });

      if (existingColor) {
        throw new BadRequestException(`El color ${name} ya existe`);
      }

      color.name = name;
    }

    if (updateColorDto.hex !== undefined) {
      color.hex = updateColorDto.hex.trim().toUpperCase();
    }

    if (updateColorDto.colorGroupId !== undefined) {
      await this.ensureColorGroupExists(updateColorDto.colorGroupId);
      color.colorGroupId = updateColorDto.colorGroupId ?? null;
    }

    await this.colorsRepository.save(color);
    const updatedColor = await this.colorsRepository.findOneOrFail({
      where: { id },
      relations: { colorGroup: true },
    });

    return this.toResponse(updatedColor);
  }

  private async ensureColorGroupExists(
    colorGroupId: number | null | undefined,
  ): Promise<void> {
    if (colorGroupId === undefined || colorGroupId === null) {
      return;
    }

    const colorGroup = await this.colorGroupsRepository.findOne({
      where: { id: colorGroupId },
      select: { id: true },
    });

    if (!colorGroup) {
      throw new BadRequestException(
        `Grupo de color ${colorGroupId} no encontrado`,
      );
    }
  }

  private toResponse(color: Color): ColorResponse {
    return {
      id: color.id,
      name: color.name,
      hex: color.hex,
      colorGroupId: color.colorGroupId,
      colorGroup: color.colorGroup
        ? {
            id: color.colorGroup.id,
            name: color.colorGroup.name,
            hex: color.colorGroup.hex,
            sortOrder: color.colorGroup.sortOrder,
          }
        : null,
    };
  }
}
