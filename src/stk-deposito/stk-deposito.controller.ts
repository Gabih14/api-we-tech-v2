import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StkDepositoService } from './stk-deposito.service';
import { CreateStkDepositoDto } from './dto/create-stk-deposito.dto';

@Controller('stk-deposito')
export class StkDepositoController {
  constructor(private readonly stkDepositoService: StkDepositoService) {}

  @Post()
  create(@Body() createStkDepositoDto: CreateStkDepositoDto) {
    return this.stkDepositoService.create(createStkDepositoDto);
  }

  @Get()
  findAll() {
    return this.stkDepositoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stkDepositoService.findOne(id);
  }
}
