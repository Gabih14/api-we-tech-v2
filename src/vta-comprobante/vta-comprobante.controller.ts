import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VtaComprobanteService } from './vta-comprobante.service';
import { CreateVtaComprobanteDto } from './dto/create-vta-comprobante.dto';
import { UpdateVtaComprobanteDto } from './dto/update-vta-comprobante.dto';

@Controller('vta-comprobante')
export class VtaComprobanteController {
  constructor(private readonly vtaComprobanteService: VtaComprobanteService) {}

  @Post()
  create(@Body() dto: CreateVtaComprobanteDto) {
    return this.vtaComprobanteService.create(dto);
  }

  @Get()
  findAll() {
    return this.vtaComprobanteService.findAll();
  }

  @Get(':tipo/:comprobante')
  findOne(@Param('tipo') tipo: string, @Param('comprobante') comprobante: string) {
    return this.vtaComprobanteService.findOne(tipo, comprobante);
  }

  @Patch(':tipo/:comprobante')
  update(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string,
    @Body() dto: UpdateVtaComprobanteDto
  ) {
    return this.vtaComprobanteService.update(tipo, comprobante, dto);
  }

  @Delete(':tipo/:comprobante')
  remove(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string
  ) {
    return this.vtaComprobanteService.remove(tipo, comprobante);
  }
}
