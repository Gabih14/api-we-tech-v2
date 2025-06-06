// src/vta-comprobante/vta-comprobante.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { CreateVtaComprobanteDto } from './dto/create-vta-comprobante.dto';
import { UpdateVtaComprobanteDto } from './dto/update-vta-comprobante.dto';
import { Pedido } from 'src/pedido/entities/pedido.entity';

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

  // 🚀 NUEVO: Crear comprobante desde un Pedido
  async crearDesdePedido(pedido: Pedido): Promise<VtaComprobante> {
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const nuevoComprobante = this.comprobanteRepository.create({
      tipo: 'FX', // Por ejemplo: factura A 01
      comprobante: this.generarNumeroComprobante(), // Lógica dummy, se puede mejorar
      cliente: pedido.cliente_cuit,
      razon_social: pedido.cliente_nombre,
      fecha: new Date(),
      periodo: this.obtenerPeriodoActual(),
      tipo_documento: 'CUIT',
      numero_documento: pedido.cliente_cuit,
      subtotal: pedido.total,
      nogravado: 0,
      total: pedido.total,
      cobrado: pedido.total,
      estado: 'GENERADO',
      mail: false,
      visible: true,
    });

    return this.comprobanteRepository.save(nuevoComprobante);
  }

  private generarNumeroComprobante(): string {
    // Podés reemplazar esto con un contador real desde la BD
    const random = Math.floor(100000 + Math.random() * 900000);
    return `CBTE-${random}`;
  }

  private obtenerPeriodoActual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
