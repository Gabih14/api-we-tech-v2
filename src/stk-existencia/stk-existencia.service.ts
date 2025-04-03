import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkExistencia } from './entities/stk-existencia.entity';
import { CreateStkExistenciaDto } from './dto/create-stk-existencia.dto';
import { UpdateStkExistenciaDto } from './dto/update-stk-existencia.dto';

@Injectable()
export class StkExistenciaService {
  constructor(
    @InjectRepository(StkExistencia)
    private readonly stkExistenciaRepository: Repository<StkExistencia>,
  ) {}

  async create(createStkExistenciaDto: CreateStkExistenciaDto): Promise<StkExistencia> {
    const existencia = this.stkExistenciaRepository.create(createStkExistenciaDto);
    return await this.stkExistenciaRepository.save(existencia);
  }

  async findAll(): Promise<StkExistencia[]> {
    return await this.stkExistenciaRepository.find();
  }

  async findOne(item: string, deposito: string): Promise<StkExistencia> {
    const existencia = await this.stkExistenciaRepository.findOne({ where: { item, deposito } });
    if (!existencia) {
      throw new NotFoundException(`Existencia no encontrada para item: ${item} y deposito: ${deposito}`);
    }
    return existencia;
  }

  async update(
    item: string,
    deposito: string,
    updateStkExistenciaDto: UpdateStkExistenciaDto,
  ): Promise<StkExistencia> {
    const existencia = await this.findOne(item, deposito);
    Object.assign(existencia, updateStkExistenciaDto);
    return await this.stkExistenciaRepository.save(existencia);
  }

  async remove(item: string, deposito: string): Promise<void> {
    const existencia = await this.findOne(item, deposito);
    await this.stkExistenciaRepository.remove(existencia);
  }
}
