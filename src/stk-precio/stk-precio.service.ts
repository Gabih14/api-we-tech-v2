import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkPrecio } from './entities/stk-precio.entity';
import { CreateStkPrecioDto } from './dto/create-stk-precio.dto';

@Injectable()
export class StkPrecioService {
  constructor(
    @InjectRepository(StkPrecio)
    private readonly stkPrecioRepository: Repository<StkPrecio>,
  ) {}

  async create(createStkPrecioDto: CreateStkPrecioDto): Promise<StkPrecio> {
    const precio = this.stkPrecioRepository.create(createStkPrecioDto);
    return await this.stkPrecioRepository.save(precio);
  }

  async findAll(): Promise<StkPrecio[]> {
    return await this.stkPrecioRepository.find({ relations: ['item2'] });
  }

  async findOne(lista: string, item: string): Promise<StkPrecio | null> {
    return await this.stkPrecioRepository.findOne({
      where: { lista, item },
      relations: ['item2'],
    });
  }
}