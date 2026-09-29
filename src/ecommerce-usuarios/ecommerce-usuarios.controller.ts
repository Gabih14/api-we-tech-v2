import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { UpdateEstadoMayoristaDto } from './dto/update-estado-mayorista.dto';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EcommerceUsuario } from './entities/ecommerce-usuario.entity';
import { ListEcommerceUsuariosDto } from './dto/list-ecommerce-usuarios.dto';
import { EcommerceUsuariosPage } from './ecommerce-usuarios.service';

@Controller('admin/ecommerce-usuarios')
export class EcommerceUsuariosController {
  constructor(
    private readonly ecommerceUsuariosService: EcommerceUsuariosService,
  ) {}

  @Get()
  @AuthType('read')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  listar(
    @Query() query: ListEcommerceUsuariosDto,
  ): Promise<EcommerceUsuariosPage> {
    return this.ecommerceUsuariosService.findAll(query);
  }

  @Get(':id')
  @AuthType('read')
  obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EcommerceUsuario> {
    return this.ecommerceUsuariosService.findOneById(id);
  }

  @Patch(':id/estado')
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoMayoristaDto,
  ): Promise<EcommerceUsuario> {
    return this.ecommerceUsuariosService.updateEstadoMayorista(id, dto.estado);
  }
}
