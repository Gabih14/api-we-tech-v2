import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { VtaClienteService } from './vta_cliente.service';
import { CreateVtaClienteDto } from './dto/create-vta_cliente.dto';
import { UpdateVtaClienteDto } from './dto/update-vta_cliente.dto';

@Controller('vta-cliente')
export class VtaClienteController {
  constructor(private readonly vtaClienteService: VtaClienteService) {}

  @Post()
  async create(@Body() dto: CreateVtaClienteDto) {
    return this.vtaClienteService.create(dto);
  }

  @Get()
  async findAll() {
    return this.vtaClienteService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cliente = await this.vtaClienteService.findOne(id);
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
    return cliente;
  }

 
}
