import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ColorResponse, ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';

@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createColorDto: CreateColorDto): Promise<ColorResponse> {
    return this.colorsService.create(createColorDto);
  }

  @Get()
  async findAll(): Promise<ColorResponse[]> {
    return this.colorsService.findAll();
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColorDto: UpdateColorDto,
  ): Promise<ColorResponse> {
    return this.colorsService.update(id, updateColorDto);
  }
}
