import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CuponUsoService } from './cupon_uso.service';
import { CreateCuponUsoDto } from './dto/create-cupon_uso.dto';
import { UpdateCuponUsoDto } from './dto/update-cupon_uso.dto';

@Controller('cupon-uso')
export class CuponUsoController {
  constructor(private readonly cuponUsoService: CuponUsoService) {}

  @Post()
  create(@Body() createCuponUsoDto: CreateCuponUsoDto) {
    return this.cuponUsoService.create(createCuponUsoDto);
  }

  @Get()
  findAll() {
    return this.cuponUsoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cuponUsoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCuponUsoDto: UpdateCuponUsoDto) {
    return this.cuponUsoService.update(+id, updateCuponUsoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cuponUsoService.remove(+id);
  }
}
