import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateColorGroupDto } from './dto/create-color-group.dto';
import { UpdateColorGroupDto } from './dto/update-color-group.dto';
import { ColorGroup } from './entities/color-group.entity';

export interface ColorGroupResponse {
  id: number;
  name: string;
  hex: string | null;
  sortOrder: number;
}

@Injectable()
export class ColorGroupsService {
  constructor(
    @InjectRepository(ColorGroup, 'back')
    private readonly colorGroupsRepository: Repository<ColorGroup>,
  ) {}

  async create(
    createColorGroupDto: CreateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    const name = createColorGroupDto.name.trim();

    if (!name) {
      throw new BadRequestException('name no puede estar vacio');
    }

    const existingColorGroup = await this.colorGroupsRepository.findOne({
      where: { name },
    });

    if (existingColorGroup) {
      throw new BadRequestException(`El grupo de color ${name} ya existe`);
    }

    const colorGroup = await this.colorGroupsRepository.save(
      this.colorGroupsRepository.create({
        name,
        hex: this.normalizeHex(createColorGroupDto.hex),
        sortOrder: createColorGroupDto.sortOrder ?? 0,
      }),
    );

    return this.toResponse(colorGroup);
  }

  async findAll(): Promise<ColorGroupResponse[]> {
    const colorGroups = await this.colorGroupsRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return colorGroups.map((colorGroup) => this.toResponse(colorGroup));
  }

  async update(
    id: number,
    updateColorGroupDto: UpdateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    const colorGroup = await this.colorGroupsRepository.findOne({
      where: { id },
    });

    if (!colorGroup) {
      throw new NotFoundException(`Grupo de color ${id} no encontrado`);
    }

    if (updateColorGroupDto.name !== undefined) {
      const name = updateColorGroupDto.name.trim();

      if (!name) {
        throw new BadRequestException('name no puede estar vacio');
      }

      const existingColorGroup = await this.colorGroupsRepository.findOne({
        where: { name, id: Not(id) },
      });

      if (existingColorGroup) {
        throw new BadRequestException(`El grupo de color ${name} ya existe`);
      }

      colorGroup.name = name;
    }

    if (updateColorGroupDto.hex !== undefined) {
      colorGroup.hex = this.normalizeHex(updateColorGroupDto.hex);
    }

    if (updateColorGroupDto.sortOrder !== undefined) {
      colorGroup.sortOrder = updateColorGroupDto.sortOrder;
    }

    const updatedColorGroup = await this.colorGroupsRepository.save(colorGroup);
    return this.toResponse(updatedColorGroup);
  }

  private normalizeHex(hex: string | null | undefined): string | null {
    if (hex === undefined || hex === null) {
      return null;
    }

    const normalizedHex = hex.trim();
    return normalizedHex ? normalizedHex.toUpperCase() : null;
  }

  private toResponse(colorGroup: ColorGroup): ColorGroupResponse {
    return {
      id: colorGroup.id,
      name: colorGroup.name,
      hex: colorGroup.hex,
      sortOrder: colorGroup.sortOrder,
    };
  }
}
