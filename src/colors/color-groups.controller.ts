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
import { AuthType } from '../common/decorators/auth-type.decorator';

@Controller('color-groups')
export class ColorGroupsController {
  constructor(private readonly colorGroupsService: ColorGroupsService) {}

  @Post()
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() createColorGroupDto: CreateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    return this.colorGroupsService.create(createColorGroupDto);
  }

  @Get()
  @AuthType('read')
  async findAll(): Promise<ColorGroupResponse[]> {
    return this.colorGroupsService.findAll();
  }

  @Patch(':id')
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColorGroupDto: UpdateColorGroupDto,
  ): Promise<ColorGroupResponse> {
    return this.colorGroupsService.update(id, updateColorGroupDto);
  }
}
