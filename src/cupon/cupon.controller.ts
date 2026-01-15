import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { CreateCuponDto } from './dto/create-cupon.dto';
import { UpdateCuponDto } from './dto/update-cupon.dto';
import { Cupon } from './entities/cupon.entity';
import { CreateCuponUsoDto } from 'src/cupon_uso/dto/create-cupon_uso.dto';
import { CuponUso } from 'src/cupon_uso/entities/cupon_uso.entity';

@Controller('cupones')
export class CuponController {
  constructor(private readonly cuponService: CuponService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async crear(@Body() crearCuponDto: CreateCuponDto): Promise<Cupon> {
    return this.cuponService.crear(crearCuponDto);
  }

  @Get()
  async listarActivos(): Promise<Cupon[]> {
    return this.cuponService.listarActivos();
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string): Promise<Cupon> {
    return this.cuponService.buscarPorId(id);
  }

  @Post('usar')
  @UsePipes(new ValidationPipe({ transform: true }))
  async usarCupon(@Body() usarCuponDto: CreateCuponUsoDto): Promise<CuponUso> {
    return this.cuponService.usarCupon(usarCuponDto);
  }

  @Get(':id/estadisticas')
  async obtenerEstadisticas(@Param('id') id: string): Promise<any> {
    return this.cuponService.obtenerEstadisticas(id);
  }

  @Delete(':id/desactivar')
  async desactivar(@Param('id') id: string): Promise<Cupon> {
    return this.cuponService.desactivar(id);
  }
}


