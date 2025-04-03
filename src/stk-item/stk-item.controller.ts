import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StkItemService } from './stk-item.service';
import { CreateStkItemDto } from './dto/create-stk-item.dto';
import { UpdateStkItemDto } from './dto/update-stk-item.dto';

@Controller('stk-item')
export class StkItemController {
  constructor(private readonly stkItemService: StkItemService) {}

  @Post()
  create(@Body() createStkItemDto: CreateStkItemDto) {
    return this.stkItemService.create(createStkItemDto);
  }

  @Get()
  findAll() {
    return this.stkItemService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stkItemService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStkItemDto: UpdateStkItemDto) {
    return this.stkItemService.update(id, updateStkItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stkItemService.remove(id);
  }
}
