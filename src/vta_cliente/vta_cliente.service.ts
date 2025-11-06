import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaCliente } from './entities/vta_cliente.entity';
import { CreateVtaClienteDto } from './dto/create-vta_cliente.dto';
import { UpdateVtaClienteDto } from './dto/update-vta_cliente.dto';

@Injectable()
export class VtaClienteService {
  constructor(
    @InjectRepository(VtaCliente)
    private readonly repo: Repository<VtaCliente>,
  ) {}

  async create(dto: CreateVtaClienteDto) {
    const cliente = this.repo.create(dto);
    return this.repo.save(cliente);
  }

  async findAll() {
    const clientes = await this.repo.find();
    return clientes.map(cliente => ({
      ...cliente,
      id: cliente.id.replace(/-/g, '')
    }));
  }

  async findOne(id: string) {
    const cliente = await this.repo.findOne({ where: { id } });
    if (!cliente) return null;
    
    return {
      ...cliente,
      id: cliente.id.replace(/-/g, '')
    };
  }

  async update(id: string, dto: UpdateVtaClienteDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    return typeof result.affected === 'number' && result.affected > 0
      ? { message: `Cliente ${id} eliminado.` }
      : { message: `Cliente ${id} no encontrado.` };
  }
}
