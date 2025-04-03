import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { StkExistenciaService } from './stk-existencia.service';
import { CreateStkExistenciaDto } from './dto/create-stk-existencia.dto';
import { UpdateStkExistenciaDto } from './dto/update-stk-existencia.dto';

@Controller('stk-existencia')
export class StkExistenciaController {
  constructor(private readonly stkExistenciaService: StkExistenciaService) {}

  @Post()
  async create(@Body() createStkExistenciaDto: CreateStkExistenciaDto) {
    return this.stkExistenciaService.create(createStkExistenciaDto);
  }

  @Get()
  async findAll() {
    return this.stkExistenciaService.findAll();
  }

  @Get(':item/:deposito')
  async findOne(@Param('item') item: string, @Param('deposito') deposito: string) {
    return this.stkExistenciaService.findOne(item, deposito);
  }

  @Patch(':item/:deposito')
  async update(
    @Param('item') item: string,
    @Param('deposito') deposito: string,
    @Body() updateStkExistenciaDto: UpdateStkExistenciaDto,
  ) {
    return this.stkExistenciaService.update(item, deposito, updateStkExistenciaDto);
  }

  @Delete(':item/:deposito')
  async remove(@Param('item') item: string, @Param('deposito') deposito: string) {
    return this.stkExistenciaService.remove(item, deposito);
  }
}
