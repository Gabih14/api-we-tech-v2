import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from "@nestjs/common";
import { BasMonedaService } from "./bas-moneda.service";
import { CreateBasMonedaDto } from "./dto/create-bas-moneda.dto";

@Controller("bas-moneda")
export class BasMonedaController {
  constructor(private readonly basMonedaService: BasMonedaService) {}

  @Get()
  async findAll() {
    return this.basMonedaService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.basMonedaService.findOne(id);
  }

  @Post()
  async create(@Body() createBasMonedaDto: CreateBasMonedaDto) {
    return this.basMonedaService.create(createBasMonedaDto);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateBasMonedaDto: CreateBasMonedaDto
  ) {
    return this.basMonedaService.update(id, updateBasMonedaDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.basMonedaService.remove(id);
  }
}
