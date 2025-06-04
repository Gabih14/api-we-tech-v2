// src/vta-comprobante/vta-comprobante.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { CreateVtaComprobanteDto } from './dto/create-vta-comprobante.dto';
import { UpdateVtaComprobanteDto } from './dto/update-vta-comprobante.dto';

@Injectable()
export class VtaComprobanteService {
  constructor(
    @InjectRepository(VtaComprobante)
    private readonly comprobanteRepository: Repository<VtaComprobante>,
  ) {}

  async create(createDto: CreateVtaComprobanteDto): Promise<VtaComprobante> {
    const comprobante = this.comprobanteRepository.create(createDto);
    return await this.comprobanteRepository.save(comprobante);
  }

  async findAll(): Promise<VtaComprobante[]> {
    return this.comprobanteRepository.find();
  }

  async findOne(tipo: string, comprobante: string): Promise<VtaComprobante> {
    const entity = await this.comprobanteRepository.findOne({ where: { tipo, comprobante } });
    if (!entity) throw new NotFoundException('Comprobante no encontrado');
    return entity;
  }

  async update(tipo: string, comprobante: string, updateDto: UpdateVtaComprobanteDto): Promise<VtaComprobante> {
    const comprobanteEntity = await this.findOne(tipo, comprobante);
    const updated = Object.assign(comprobanteEntity, updateDto);
    return this.comprobanteRepository.save(updated);
  }

  async remove(tipo: string, comprobante: string): Promise<void> {
    const comprobanteEntity = await this.findOne(tipo, comprobante);
    await this.comprobanteRepository.remove(comprobanteEntity);
  }
}
