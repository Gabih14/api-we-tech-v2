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

  /**
   * Busca un cliente por CUIT (id). Si no existe, lo crea.
   * Si existe y cambió algún dato, lo actualiza.
   */
  /* findOrCreateOrUpdate */
  async findOrCreateOrUpdate(dto: CreateVtaClienteDto): Promise<VtaCliente> {
    if (!dto.id) {
      throw new Error('El cliente debe tener un CUIT válido como ID.');
    }

    const existing = await this.repo.findOne({ where: { id: dto.id } });

    if (existing) {
      // Chequea si hay diferencias
      const hasChanges = Object.entries(dto).some(
        ([key, value]) =>
          value !== undefined &&
          value !== null &&
          value !== (existing as any)[key],
      );

      if (hasChanges) {
        await this.repo.update(dto.id, dto);
      }

      // ✅ Asegurar que retornamos el cliente actualizado
      const updated = await this.repo.findOne({ where: { id: dto.id } });
      if (!updated) {
        throw new Error('Error al recuperar el cliente actualizado');
      }
      return updated;
    }

    const nuevoCliente = this.repo.create({
      id: dto.id,
      razonSocial: dto.razonSocial || 'Cliente sin nombre', // ✅ Quitar dto.name
      nombreComercial: dto.nombreComercial || null,          // ✅ Quitar dto.name
      tipoDocumento: dto.tipoDocumento || 'CUIT',
      numeroDocumento: dto.numeroDocumento || dto.id,
      email: dto.email || null,
      telefono: dto.telefono || null,
      visible: true,
    });

    return this.repo.save(nuevoCliente);
  }

  async create(dto: CreateVtaClienteDto) {
    const cliente = this.repo.create(dto);
    return this.repo.save(cliente);
  }

  async findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateVtaClienteDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    return result.affected && result.affected > 0
      ? { message: `Cliente ${id} eliminado.` }
      : { message: `Cliente ${id} no encontrado.` };
  }
}
