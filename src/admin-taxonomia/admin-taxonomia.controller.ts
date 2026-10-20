import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { AdminTaxonomiaService } from './admin-taxonomia.service';
import { AsignacionesService } from './asignaciones.service';
import { AuditoriaService } from './auditoria.service';
import { CreateAtributoDto } from './dto/create-atributo.dto';
import { ListArbolesDto } from './dto/list-arboles.dto';
import { ListAtributosDto } from './dto/list-atributos.dto';
import { ListAuditoriaDto } from './dto/list-auditoria.dto';
import { PreviewAsignacionDto } from './dto/preview-asignacion.dto';
import { SetArbolAtributoDto } from './dto/set-arbol-atributo.dto';
import { UpdateAtributoDto } from './dto/update-atributo.dto';

@Controller('admin/taxonomia')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class AdminTaxonomiaController {
  constructor(
    private readonly taxonomia: AdminTaxonomiaService,
    private readonly asignaciones: AsignacionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('arboles')
  @AuthType('read')
  listarArboles(@Query() query: ListArbolesDto) {
    return this.taxonomia.listarArboles(query);
  }

  @Get('arboles/:arbol')
  @AuthType('read')
  obtenerArbol(@Param('arbol') arbol: string) {
    return this.taxonomia.obtenerArbol(arbol);
  }

  @Post('arboles/:arbol/atributos/preview')
  @AuthType('read')
  preview(@Param('arbol') arbol: string, @Body() dto: PreviewAsignacionDto) {
    return this.asignaciones.preview(arbol, dto.clase, dto.atributoId);
  }

  @Put('arboles/:arbol/atributos/:clase')
  @AuthType('write')
  reemplazar(
    @Param('arbol') arbol: string,
    @Param('clase') clase: string,
    @Body() dto: SetArbolAtributoDto,
  ) {
    return this.asignaciones.reemplazar(arbol, clase, dto.atributoId);
  }

  @Delete('arboles/:arbol/atributos/:clase')
  @AuthType('write')
  eliminar(@Param('arbol') arbol: string, @Param('clase') clase: string) {
    return this.asignaciones.eliminar(arbol, clase);
  }

  @Get('atributos')
  @AuthType('read')
  listarAtributos(@Query() query: ListAtributosDto) {
    return this.taxonomia.listarAtributos(query);
  }

  @Get('atributos/:id')
  @AuthType('read')
  obtenerAtributo(@Param('id') id: string) {
    return this.taxonomia.obtenerAtributo(id);
  }

  @Post('atributos')
  @AuthType('write')
  crearAtributo(@Body() dto: CreateAtributoDto) {
    return this.taxonomia.crearAtributo(dto);
  }

  @Patch('atributos/:id')
  @AuthType('write')
  actualizarAtributo(@Param('id') id: string, @Body() dto: UpdateAtributoDto) {
    return this.taxonomia.actualizarAtributo(id, dto);
  }

  @Get('auditoria')
  @AuthType('read')
  auditar(@Query() query: ListAuditoriaDto) {
    return this.auditoria.auditar(query);
  }
}
