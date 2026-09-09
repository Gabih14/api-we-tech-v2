import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ColorAssignmentResponse,
  ColorResponse,
  ColorsService,
  LegacyColorsMigrationResponse,
} from './colors.service';
import { AssignColorDto } from './dto/assign-color.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { AuthType } from '../common/decorators/auth-type.decorator';

@Controller('colors')
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Post()
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createColorDto: CreateColorDto): Promise<ColorResponse> {
    return this.colorsService.create(createColorDto);
  }

  @Get()
  @AuthType('read')
  async findAll(): Promise<ColorResponse[]> {
    return this.colorsService.findAll();
  }

  @Post('migrate-legacy')
  @AuthType('write')
  migrateLegacy(): Promise<LegacyColorsMigrationResponse> {
    return this.colorsService.migrateLegacyBridges();
  }

  @Put('legacy/:bridgeId/:colorId')
  @AuthType('write')
  linkLegacyBridge(
    @Param('bridgeId', ParseIntPipe) bridgeId: number,
    @Param('colorId') colorId: string,
  ): Promise<ColorResponse> {
    return this.colorsService.linkLegacyBridge(bridgeId, colorId);
  }

  @Get('items/:itemId')
  @AuthType('dashboard')
  getItemColors(
    @Param('itemId') itemId: string,
  ): Promise<ColorAssignmentResponse> {
    return this.colorsService.getItemColors(itemId);
  }

  @Put(':id/items/:itemId')
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  assignToItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: AssignColorDto,
  ): Promise<ColorAssignmentResponse> {
    return this.colorsService.assignToItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @AuthType('write')
  async unassignFromItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.colorsService.unassignFromItem(id, itemId);
  }

  @Patch(':id')
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string,
    @Body() updateColorDto: UpdateColorDto,
  ): Promise<ColorResponse> {
    return this.colorsService.update(id, updateColorDto);
  }
}
