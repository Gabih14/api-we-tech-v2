import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VtaComprobanteAsientoService } from './vta_comprobante_asiento.service';
import { CreateVtaComprobanteAsientoDto } from './dto/create-vta_comprobante_asiento.dto';
import { UpdateVtaComprobanteAsientoDto } from './dto/update-vta_comprobante_asiento.dto';

@Controller('vta-comprobante-asiento')
export class VtaComprobanteAsientoController {
  constructor(private readonly vtaComprobanteAsientoService: VtaComprobanteAsientoService) {}

  @Post()
  create(@Body() createVtaComprobanteAsientoDto: CreateVtaComprobanteAsientoDto) {
    return this.vtaComprobanteAsientoService.create(createVtaComprobanteAsientoDto);
  }

  @Get()
  findAll() {
    return this.vtaComprobanteAsientoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vtaComprobanteAsientoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVtaComprobanteAsientoDto: UpdateVtaComprobanteAsientoDto) {
    return this.vtaComprobanteAsientoService.update(+id, updateVtaComprobanteAsientoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vtaComprobanteAsientoService.remove(+id);
  }
}
