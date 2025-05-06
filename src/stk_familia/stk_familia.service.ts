import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkFamilia } from './entities/stk_familia.entity';
import { CreateStkFamiliaDto } from './dto/create-stk_familia.dto';

@Injectable()
export class StkFamiliaService {
  constructor(
    @InjectRepository(StkFamilia)
    private readonly stkFamiliaRepository: Repository<StkFamilia>,
  ) {}

  async create(createStkFamiliaDto: CreateStkFamiliaDto): Promise<StkFamilia> {
    const familia = this.stkFamiliaRepository.create(createStkFamiliaDto);
    return await this.stkFamiliaRepository.save(familia);
  }

  async findAll(): Promise<StkFamilia[]> {
    return this.stkFamiliaRepository.find({ relations: ['stkItems'] });
  }

  async findOne(id: string): Promise<StkFamilia> {
    const familia = await this.stkFamiliaRepository.findOne({
      where: { id },
      relations: ['stkItems'],
    });
    if (!familia) {
      throw new Error(`StkFamilia with id ${id} not found`);
    }
    return familia;
  }
}
