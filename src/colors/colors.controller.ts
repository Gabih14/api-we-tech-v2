import {
  Body,
  Controller,
  Get,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ColorResponse, ColorsService } from './colors.service';
import { CreateColorDto } from './dto/create-color.dto';

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
}
