import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BasMoneda } from "./entities/bas-moneda.entity";
import { CreateBasMonedaDto } from "./dto/create-bas-moneda.dto";

@Injectable()
export class BasMonedaService {
  constructor(
    @InjectRepository(BasMoneda)
    private readonly basMonedaRepo: Repository<BasMoneda>
  ) {}

  async findAll(): Promise<BasMoneda[]> {
    return this.basMonedaRepo.find();
  }

  async findOne(id: string): Promise<BasMoneda> {
    const moneda = await this.basMonedaRepo.findOne({ where: { id } });
    if (!moneda) throw new NotFoundException("Moneda no encontrada");
    return moneda;
  }

  async create(createBasMonedaDto: CreateBasMonedaDto): Promise<BasMoneda> {
    const moneda = this.basMonedaRepo.create(createBasMonedaDto);
    return this.basMonedaRepo.save(moneda);
  }

  async update(id: string, updateBasMonedaDto: CreateBasMonedaDto): Promise<BasMoneda> {
    await this.findOne(id); // Verifica si existe
    await this.basMonedaRepo.update(id, updateBasMonedaDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const moneda = await this.findOne(id);
    await this.basMonedaRepo.remove(moneda);
  }
}
