import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateColorDto } from './dto/create-color.dto';
import { Color } from './entities/color.entity';

export interface ColorResponse {
  name: string;
  hex: string;
}

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color, 'back')
    private readonly colorsRepository: Repository<Color>,
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

    const color = await this.colorsRepository.save(
      this.colorsRepository.create({ name, hex }),
    );

    return this.toResponse(color);
  }

  async findAll(): Promise<ColorResponse[]> {
    const colors = await this.colorsRepository.find({
      order: { name: 'ASC' },
    });

    return colors.map((color) => this.toResponse(color));
  }

  private toResponse(color: Color): ColorResponse {
    return {
      name: color.name,
      hex: color.hex,
    };
  }
}
