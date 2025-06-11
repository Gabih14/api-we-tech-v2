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
  ) { }

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
    const numero = await this.generarNumeroComprobante();
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const nuevoComprobante = this.comprobanteRepository.create({
      tipo: 'FX', // Por ejemplo: factura A 01
      comprobante: numero,
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

  private async generarNumeroComprobante(): Promise<string> {
    const tipo = 'X';
    const puntoDeVenta = '00001';

    // Buscar el último comprobante emitido con este tipo y punto de venta
    const ultimo = await this.comprobanteRepository
      .createQueryBuilder('c')
      .where("c.comprobante LIKE :prefix", { prefix: `${tipo}-${puntoDeVenta}-%` })
      .orderBy('c.comprobante', 'DESC')
      .getOne();

    let nuevoNumero = 1;

    if (ultimo) {
      // Extraer número actual del string
      const partes = ultimo.comprobante.split('-'); // [tipo, puntoDeVenta, numero]
      const numeroActual = parseInt(partes[2], 10);
      nuevoNumero = numeroActual + 1;
    }

    const numeroFormateado = nuevoNumero.toString().padStart(8, '0'); // 00000025

    return `${tipo}-${puntoDeVenta}-${numeroFormateado}`;
  }


  private obtenerPeriodoActual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
