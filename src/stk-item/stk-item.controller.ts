import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { StkItemService } from './stk-item.service';
import { CreateStkItemDto } from './dto/create-stk-item.dto';
import { UpdateStkItemDto } from './dto/update-stk-item.dto';

@Controller('stk-item')
export class StkItemController {
  constructor(private readonly stkItemService: StkItemService) {}

  @Post()
  create(@Body() createStkItemDto: CreateStkItemDto) {
    return this.stkItemService.create(createStkItemDto);
  }

  @Get()
  findAll(
    @Query('material') material?: string,
    @Query('nivel') nivel?: string,
    @Query('aptoAlimentos') aptoAlimentos?: string,
    @Query('marca') marca?: string,
    @Query('color') color?: string,
  ) {
    return this.stkItemService.findAll({
      material,
      nivel,
      aptoAlimentos,
      marca,
      color,
    });
  }

  /** Valores disponibles por clase de atributo, para poblar los selects de filtros. */
  @Get('atributos/facetas')
  getFacetasAtributos() {
    return this.stkItemService.getFacetasAtributos();
  }

  /**
   * Catálogo "armado": todos los ítems agrupados en productos con sus variantes
   * (peso, color, etc.) y atributos, para reemplazar el armado manual en la web.
   */
  @Get('catalogo')
  getCatalogo() {
    return this.stkItemService.getCatalogo();
  }

  @Get('costo/:distancia')
  getCostoEnvio(@Param('distancia') distancia: string) {
    const distanciaNum = parseFloat(distancia);
    return this.stkItemService.getCostoEnvio(distanciaNum);
  }

  /** Ficha técnica (atributos) de un ítem, fusionando los del padre GENERICO. */
  @Get(':id/atributos')
  getAtributos(@Param('id') id: string) {
    return this.stkItemService.getAtributos(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('atributos') atributos?: string) {
    const includeAtributos = atributos === 'true' || atributos === '1';
    return this.stkItemService.findOne(id, includeAtributos);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStkItemDto: UpdateStkItemDto) {
    return this.stkItemService.update(id, updateStkItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stkItemService.remove(id);
  }
}
