import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseFloatPipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StkItemService } from './stk-item.service';
import { CreateStkItemDto } from './dto/create-stk-item.dto';
import { UpdateStkItemDto } from './dto/update-stk-item.dto';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { MayoristaGuard } from '../ecommerce-usuarios/mayorista.guard';

@Controller('stk-item')
export class StkItemController {
  constructor(
    private readonly stkItemService: StkItemService,
    private readonly config: ConfigService,
  ) {}

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
  @AuthType('default', 'dashboard')
  getCatalogo() {
    return this.stkItemService.getCatalogo();
  }

  @Get('catalogo/mayorista')
  @AuthType('public')
  @UseGuards(ClerkAuthGuard, MayoristaGuard)
  async getCatalogoMayorista() {
    const minimumPurchaseKg = Number(
      this.config.getOrThrow<string>('WHOLESALE_MIN_PURCHASE_KG'),
    );
    if (!Number.isFinite(minimumPurchaseKg) || minimumPurchaseKg <= 0) {
      throw new Error('WHOLESALE_MIN_PURCHASE_KG debe ser mayor que cero');
    }

    return {
      minimumPurchaseKg,
      products: await this.stkItemService.getCatalogo(true),
    };
  }

  @Get('costo/:distancia')
  getCostoEnvio(
    @Param('distancia', ParseFloatPipe) distancia: number,
    @Query('provincia') provincia?: string,
    @Query('departamento') departamento?: string,
  ) {
    return this.stkItemService.getCostoEnvio(
      distancia,
      provincia,
      departamento,
    );
  }

  /** Ficha técnica (atributos) de un ítem, fusionando los del padre GENERICO. */
  @Get('envios-clientes')
  @AuthType('dashboard')
  getItemsEnviosAClientes() {
    return this.stkItemService.getItemsEnviosAClientes();
  }

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
