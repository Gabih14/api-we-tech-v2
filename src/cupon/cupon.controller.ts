import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CuponService, CuponConResumenUsos } from './cupon.service';
import { CreateCuponDto } from './dto/create-cupon.dto';
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
  async listarActivos(): Promise<CuponConResumenUsos[]> {
    return this.cuponService.listarActivos();
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string): Promise<Cupon> {
    return this.cuponService.buscarPorId(id);
  }

  @Post('usar')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UsePipes(new ValidationPipe({ transform: true }))
  async usarCupon(@Body() usarCuponDto: CreateCuponUsoDto): Promise<CuponUso> {
    return this.cuponService.usarCupon(usarCuponDto);
  }

  @Get(':id/descuento/:modalidad')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async resolverDescuentoPorModalidad(
    @Param('id') id: string,
    @Param('modalidad') modalidad: string,
  ) {
    return this.cuponService.resolverPorcentajePorModalidad(id, modalidad);
  }

  @Get(':id/estadisticas')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async obtenerEstadisticas(@Param('id') id: string): Promise<any> {
    return this.cuponService.obtenerEstadisticas(id);
  }

  @Delete(':id/desactivar')
  async desactivar(@Param('id') id: string): Promise<Cupon> {
    return this.cuponService.desactivar(id);
  }
}
