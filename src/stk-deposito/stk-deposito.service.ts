import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkDeposito } from './entities/stk-deposito.entity';
import { CreateStkDepositoDto } from './dto/create-stk-deposito.dto';

@Injectable()
export class StkDepositoService {
  constructor(
    @InjectRepository(StkDeposito)
    private readonly stkDepositoRepository: Repository<StkDeposito>,
  ) {}

  async create(createStkDepositoDto: CreateStkDepositoDto): Promise<StkDeposito> {
    const deposito = this.stkDepositoRepository.create(createStkDepositoDto);
    return await this.stkDepositoRepository.save(deposito);
  }

  async findAll(): Promise<StkDeposito[]> {
    return await this.stkDepositoRepository.find({ relations: ['stkExistencias'] });
  }

  async findOne(id: string): Promise<StkDeposito | null> {
    return await this.stkDepositoRepository.findOne({
      where: { id },
      relations: ['stkExistencias'],
    });
  }
  
}
