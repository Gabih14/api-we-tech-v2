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
import {
  ColorGroupResponse,
  ColorGroupsService,
} from './color-groups.service';
import { CreateColorGroupDto } from './dto/create-color-group.dto';
import { UpdateColorGroupDto } from './dto/update-color-group.dto';

@Controller('color-groups')
export class ColorGroupsController {
  constructor(private readonly colorGroupsService: ColorGroupsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() createColorGroupDto: CreateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    return this.colorGroupsService.create(createColorGroupDto);
  }

  @Get()
  async findAll(): Promise<ColorGroupResponse[]> {
    return this.colorGroupsService.findAll();
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColorGroupDto: UpdateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    return this.colorGroupsService.update(id, updateColorGroupDto);
  }
}
