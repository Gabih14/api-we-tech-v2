import { Controller, Post, Body, Get, Param, Put, Delete } from '@nestjs/common';
import { SysImageService } from './sys_image.service';
import { CreateSysImageDto } from './dto/create-sys_image.dto';

@Controller('sys-image')
export class SysImageController {
  constructor(private readonly sysImageService: SysImageService) {}

  @Post()
  create(@Body() dto: CreateSysImageDto) {
    return this.sysImageService.create(dto);
  }

  @Get()
  findAll() {
    return this.sysImageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sysImageService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateSysImageDto) {
    return this.sysImageService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sysImageService.remove(id);
  }
}
