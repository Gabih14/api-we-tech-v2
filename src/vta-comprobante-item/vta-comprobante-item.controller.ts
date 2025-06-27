import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { VtaComprobanteItemService } from './vta-comprobante-item.service';
import { CreateVtaComprobanteItemDto } from './dto/create-vta-comprobante-item.dto';
import { UpdateVtaComprobanteItemDto } from './dto/update-vta-comprobante-item.dto';

@Controller('vta-comprobante-item')
export class VtaComprobanteItemController {
  constructor(private readonly service: VtaComprobanteItemService) {}

  @Post()
  create(@Body() dto: CreateVtaComprobanteItemDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVtaComprobanteItemDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
