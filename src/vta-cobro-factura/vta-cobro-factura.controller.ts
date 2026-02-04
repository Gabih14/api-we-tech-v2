import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VtaCobroFacturaService } from './vta-cobro-factura.service';
import { CreateVtaCobroFacturaDto } from './dto/create-vta-cobro-factura.dto';
import { UpdateVtaCobroFacturaDto } from './dto/update-vta-cobro-factura.dto';

@Controller('vta-cobro-factura')
export class VtaCobroFacturaController {
  constructor(private readonly vtaCobroFacturaService: VtaCobroFacturaService) {}

  @Post()
  create(@Body() createVtaCobroFacturaDto: CreateVtaCobroFacturaDto) {
    return this.vtaCobroFacturaService.create(createVtaCobroFacturaDto);
  }

  @Get()
  findAll() {
    return this.vtaCobroFacturaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vtaCobroFacturaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVtaCobroFacturaDto: UpdateVtaCobroFacturaDto) {
    return this.vtaCobroFacturaService.update(+id, updateVtaCobroFacturaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vtaCobroFacturaService.remove(+id);
  }
}
