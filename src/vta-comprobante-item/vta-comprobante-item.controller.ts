import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
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

  @Get(':tipo/:comprobante/:linea')
  findOne(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string,
    @Param('linea', ParseIntPipe) linea: number,
  ) {
    return this.service.findOne(tipo,comprobante, linea);
  }

  @Patch(':tipo/:comprobante/:linea')
  update(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string,
    @Param('linea', ParseIntPipe) linea: number,
    @Body() dto: UpdateVtaComprobanteItemDto,
  ) {
    return this.service.update( tipo, comprobante, linea , dto);
  }

  @Delete(':tipo/:comprobante/:linea')
  remove(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string,
    @Param('linea', ParseIntPipe) linea: number,
  ) {
    return this.service.remove( tipo, comprobante, linea );
  }
}
