import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VtaCobroMedioService } from './vta-cobro-medio.service';
import { CreateVtaCobroMedioDto } from './dto/create-vta-cobro-medio.dto';
import { UpdateVtaCobroMedioDto } from './dto/update-vta-cobro-medio.dto';

@Controller('vta-cobro-medio')
export class VtaCobroMedioController {
  constructor(private readonly vtaCobroMedioService: VtaCobroMedioService) {}

  @Post()
  create(@Body() createVtaCobroMedioDto: CreateVtaCobroMedioDto) {
    return this.vtaCobroMedioService.create(createVtaCobroMedioDto);
  }

  @Get()
  findAll() {
    return this.vtaCobroMedioService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vtaCobroMedioService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVtaCobroMedioDto: UpdateVtaCobroMedioDto) {
    return this.vtaCobroMedioService.update(+id, updateVtaCobroMedioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vtaCobroMedioService.remove(+id);
  }
}
