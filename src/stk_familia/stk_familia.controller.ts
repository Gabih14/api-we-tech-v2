import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { StkFamiliaService } from './stk_familia.service';
import { CreateStkFamiliaDto } from './dto/create-stk_familia.dto';

@Controller('stk-familia')
export class StkFamiliaController {
  constructor(private readonly stkFamiliaService: StkFamiliaService) {}

  @Post()
  async create(@Body() createStkFamiliaDto: CreateStkFamiliaDto) {
    return this.stkFamiliaService.create(createStkFamiliaDto);
  }

  @Get()
  async findAll() {
    return this.stkFamiliaService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.stkFamiliaService.findOne(id);
  }
}
