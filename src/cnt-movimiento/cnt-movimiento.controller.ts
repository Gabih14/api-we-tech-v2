import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CntMovimientoService } from './cnt-movimiento.service';
import { CreateCntMovimientoDto } from './dto/create-cnt-movimiento.dto';
import { UpdateCntMovimientoDto } from './dto/update-cnt-movimiento.dto';

@Controller('cnt-movimiento')
export class CntMovimientoController {
  constructor(private readonly cntMovimientoService: CntMovimientoService) {}

  @Post()
  create(@Body() createCntMovimientoDto: CreateCntMovimientoDto) {
    return this.cntMovimientoService.create(createCntMovimientoDto);
  }

  @Get()
  findAll() {
    return this.cntMovimientoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cntMovimientoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCntMovimientoDto: UpdateCntMovimientoDto) {
    return this.cntMovimientoService.update(+id, updateCntMovimientoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cntMovimientoService.remove(+id);
  }
}
