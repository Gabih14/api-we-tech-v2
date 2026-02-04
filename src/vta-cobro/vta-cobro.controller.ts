import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VtaCobroService } from './vta-cobro.service';
import { CreateVtaCobroDto } from './dto/create-vta-cobro.dto';
import { UpdateVtaCobroDto } from './dto/update-vta-cobro.dto';

@Controller('vta-cobro')
export class VtaCobroController {
  constructor(private readonly vtaCobroService: VtaCobroService) {}

  @Post()
  create(@Body() createVtaCobroDto: CreateVtaCobroDto) {
    return this.vtaCobroService.create(createVtaCobroDto);
  }

  @Get()
  findAll() {
    return this.vtaCobroService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vtaCobroService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVtaCobroDto: UpdateVtaCobroDto) {
    return this.vtaCobroService.update(+id, updateVtaCobroDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vtaCobroService.remove(+id);
  }
}
