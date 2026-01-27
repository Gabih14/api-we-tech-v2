// src/vta-comprobante/vta-comprobante.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { VtaComprobanteItemService } from 'src/vta-comprobante-item/vta-comprobante-item.service';
import { VtaClienteService } from 'src/vta_cliente/vta_cliente.service';
import { CreateVtaClienteDto } from 'src/vta_cliente/dto/create-vta_cliente.dto';
import { VtaComprobanteAsientoService } from 'src/vta_comprobante_asiento/vta_comprobante_asiento.service';

@Injectable()
export class VtaComprobanteService {
  constructor(
    @InjectRepository(VtaComprobante)
    private readonly comprobanteRepository: Repository<VtaComprobante>,

    private readonly comprobanteItemService: VtaComprobanteItemService,
    private readonly clienteService: VtaClienteService,
    private readonly vtaComprobanteAsientoService: VtaComprobanteAsientoService,
  ) {}

  // 🧾 Crear comprobante a partir de un pedido aprobado
  async crearDesdePedido(pedido: Pedido): Promise<VtaComprobante> {
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    // 👤 Asegurar que el cliente exista (crear/actualizar según corresponda)
    const clientePayload: CreateVtaClienteDto = {
      id: pedido.cliente_cuit,
      razonSocial: pedido.cliente_nombre,
      tipoDocumento: 'CUIT',
      numeroDocumento: pedido.cliente_cuit,
      visible: true,
    };
    await this.clienteService.findOrCreateOrUpdate(clientePayload);

    const numero = await this.generarNumeroComprobante();

    // 🧱 Crear el comprobante base
    const nuevoComprobante = this.comprobanteRepository.create({
      tipo: 'FX',
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
      mail: false,
      visible: true,
    });

    const comprobanteGuardado = await this.comprobanteRepository.save(nuevoComprobante);

    // 🧮 Crear ítems asociados
    let linea = 1;
    for (const producto of pedido.productos) {
      await this.comprobanteItemService.create({
        tipo: comprobanteGuardado.tipo,
        comprobante: comprobanteGuardado.comprobante,
        linea,
        cantidad: producto.cantidad,
        precio: producto.precio_unitario,
        importe: producto.cantidad * producto.precio_unitario,
        itemId: producto.nombre, // el ID del producto
      } as any);
      linea++;
    }

    // 📝 Generar asiento contable y vínculo
    await this.vtaComprobanteAsientoService.createAsientoForComprobante(
      comprobanteGuardado.tipo,
      comprobanteGuardado.comprobante,
    );

    return comprobanteGuardado;
  }

  // 🔢 Genera el número en formato "X 00001 00000227"
  private async generarNumeroComprobante(): Promise<string> {
    const letra = 'X';
    const puntoDeVenta = '00001';

    const ultimo = await this.comprobanteRepository
      .createQueryBuilder('c')
      .where('c.tipo = :tipo', { tipo: 'FX' })
      .andWhere('c.comprobante LIKE :prefix', { prefix: `${letra} ${puntoDeVenta} %` })
      .orderBy('c.comprobante', 'DESC')
      .getOne();

    let nuevoNumero = 1;

    if (ultimo) {
      const partes = ultimo.comprobante.trim().split(' ');
      const numeroActual = parseInt(partes[2], 10);
      if (!isNaN(numeroActual)) nuevoNumero = numeroActual + 1;
    }

    const numeroFormateado = nuevoNumero.toString().padStart(8, '0');
    return `${letra} ${puntoDeVenta} ${numeroFormateado}`;
  }

  // 📅 Devuelve el período en formato "MM/YYYY"
  private obtenerPeriodoActual(): string {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }

  // 🔍 Métodos básicos opcionales
  async findAll(): Promise<VtaComprobante[]> {
    return this.comprobanteRepository.find({ relations: ['items'] });
  }

  async findOne(tipo: string, comprobante: string): Promise<VtaComprobante> {
    const entity = await this.comprobanteRepository.findOne({
      where: { tipo, comprobante },
      relations: ['items'],
    });
    if (!entity) throw new NotFoundException('Comprobante no encontrado');
    return entity;
  }
}
