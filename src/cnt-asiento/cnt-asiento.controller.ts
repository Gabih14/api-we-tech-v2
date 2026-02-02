import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CntAsientoService } from './cnt-asiento.service';
import { CreateCntAsientoDto } from './dto/create-cnt-asiento.dto';
import { UpdateCntAsientoDto } from './dto/update-cnt-asiento.dto';

@Controller('cnt-asiento')
export class CntAsientoController {
  constructor(private readonly cntAsientoService: CntAsientoService) {}

  @Post()
  create(@Body() createCntAsientoDto: CreateCntAsientoDto) {
    return this.cntAsientoService.create(createCntAsientoDto);
  }

  @Get()
  findAll() {
    return this.cntAsientoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cntAsientoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCntAsientoDto: UpdateCntAsientoDto) {
    return this.cntAsientoService.update(+id, updateCntAsientoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cntAsientoService.remove(+id);
  }
}
