import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StkPrecioService } from './stk-precio.service';
import { CreateStkPrecioDto } from './dto/create-stk-precio.dto';

@Controller('stk-precio')
export class StkPrecioController {
  constructor(private readonly stkPrecioService: StkPrecioService) {}

  @Post()
  create(@Body() createStkPrecioDto: CreateStkPrecioDto) {
    return this.stkPrecioService.create(createStkPrecioDto);
  }

  @Get()
  findAll() {
    return this.stkPrecioService.findAll();
  }

  @Get(':lista/:item')
  findOne(@Param('lista') lista: string, @Param('item') item: string) {
    return this.stkPrecioService.findOne(lista, item);
  }
}
