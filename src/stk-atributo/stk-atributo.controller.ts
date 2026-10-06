import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { ListStkAtributoDto } from './dto/list-stk-atributo.dto';
import { ListSubgruposDto } from './dto/list-subgrupos.dto';
import { UpdateStkAtributoClasificacionDto } from './dto/update-stk-atributo-clasificacion.dto';
import { StkAtributoService } from './stk-atributo.service';

@Controller('stk-atributo')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StkAtributoController {
  constructor(private readonly service: StkAtributoService) {}

  @Get()
  @AuthType('read')
  findAll(@Query() filters: ListStkAtributoDto) {
    return this.service.findAll(filters);
  }

  @Get('grupos')
  @AuthType('read')
  findGrupos() {
    return this.service.findGrupos();
  }

  @Get('subgrupos')
  @AuthType('read')
  findSubgrupos(@Query() query: ListSubgruposDto) {
    return this.service.findSubgrupos(query.grupo);
  }

  @Patch(':id/clasificacion')
  @AuthType('write')
  updateClasificacion(
    @Param('id') id: string,
    @Body() dto: UpdateStkAtributoClasificacionDto,
  ) {
    return this.service.updateClasificacion(id, dto);
  }
}
