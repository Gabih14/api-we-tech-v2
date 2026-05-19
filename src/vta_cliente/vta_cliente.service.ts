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
    const clienteDto = this.normalizarClienteDto(dto);

    if (!clienteDto.id) {
      throw new Error('El cliente debe tener un CUIT válido como ID.');
    }

    const existing = await this.repo.findOne({ where: { id: clienteDto.id } });

    if (existing) {
      // Chequea si hay diferencias
      const hasChanges = Object.entries(clienteDto).some(
        ([key, value]) =>
          value !== undefined &&
          value !== null &&
          value !== (existing as any)[key],
      );

      if (hasChanges) {
        await this.repo.update(clienteDto.id, clienteDto);
      }

      // ✅ Asegurar que retornamos el cliente actualizado
      const updated = await this.repo.findOne({ where: { id: clienteDto.id } });
      if (!updated) {
        throw new Error('Error al recuperar el cliente actualizado');
      }
      return updated;
    }

    const nuevoCliente = this.repo.create({
      ...clienteDto,
      id: clienteDto.id,
      razonSocial: clienteDto.razonSocial || 'Cliente sin nombre', // ✅ Quitar dto.name
      nombreComercial: clienteDto.nombreComercial || null,          // ✅ Quitar dto.name
      tipoDocumento: clienteDto.tipoDocumento || 'CUIT',
      numeroDocumento: clienteDto.numeroDocumento || clienteDto.id,
      email: clienteDto.email || null,
      telefono: clienteDto.telefono || null,
      condicionIva: clienteDto.condicionIva || 'CF',
      visible: clienteDto.visible ?? true,
      contacto: clienteDto.contacto || null,
    });

    return this.repo.save(nuevoCliente);
  }

  async create(dto: CreateVtaClienteDto) {
    const cliente = this.repo.create(this.normalizarClienteDto(dto));
    return this.repo.save(cliente);
  }

  private normalizarClienteDto(dto: CreateVtaClienteDto): CreateVtaClienteDto {
    const telefono = this.formatearTelefono(dto.telefono);

    return {
      ...dto,
      numeroDocumento: this.formatearNumeroDocumento(
        dto.numeroDocumento || dto.id,
      ),
      telefono,
      contacto: telefono,
      condicionIva: dto.condicionIva || 'CF',
    };
  }

  private formatearNumeroDocumento(value?: string): string | undefined {
    if (!value) return undefined;

    const digitos = value.replace(/\D/g, '');
    if (digitos.length !== 11) {
      return value;
    }

    return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
  }

  private formatearTelefono(value?: string): string | undefined {
    if (!value) return undefined;

    const digitos = value.replace(/\D/g, '');
    if (!digitos) {
      return value;
    }

    /* if (digitos.startsWith('549')) {
      return `+54 9 ${digitos.slice(3)}`;
    } */

    if (digitos.startsWith('54')) {
      return `+54${digitos.slice(2)}`;
    }

    

    return `+54${digitos}`;
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
