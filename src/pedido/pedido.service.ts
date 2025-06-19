// src/pedido/pedido.service.ts
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pedido } from './entities/pedido.entity';
import { Repository } from 'typeorm';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { VtaComprobanteService } from 'src/vta-comprobante/vta-comprobante.service';
/* import fetch from 'node-fetch'; */

@Injectable()
export class PedidoService {
  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,

    @InjectRepository(StkItem)
    private readonly stkItemRepo: Repository<StkItem>,

    @Inject(forwardRef(() => StkExistenciaService))
    private readonly stockService: StkExistenciaService,

    @Inject(forwardRef(() => VtaComprobanteService))
    private readonly vtaComprobanteService: VtaComprobanteService,
  ) { }

  async crear(dto: CreatePedidoDto): Promise<{ pedido: Pedido; naveUrl: string }> {
    const productosValidados: { nombre: string; cantidad: number; precio_unitario: number }[] = [];

    for (const producto of dto.productos) {
      const item = await this.stkItemRepo.findOne({ where: { id: producto.nombre } });

      if (!item) {
        throw new NotFoundException(`Producto '${producto.nombre}' no existe en catálogo.`);
      }

      await this.stockService.reservarStock(item.id, producto.cantidad, 'DEPOSITO');

      productosValidados.push({
        nombre: producto.nombre,
        cantidad: producto.cantidad,
        precio_unitario: producto.precio_unitario,
      });
    }

    const pedido = this.pedidoRepo.create({
      cliente_cuit: dto.cliente_cuit,
      cliente_nombre: dto.cliente_nombre,
      external_id: dto.external_id,
      total: dto.total,
      estado: 'PENDIENTE',
      productos: productosValidados,
    });

    const pedidoGuardado = await this.pedidoRepo.save(pedido);

    const naveUrl = await this.generarIntencionDePago(dto);

    return { pedido: pedidoGuardado, naveUrl };
  }

  async generarIntencionDePago(dto: CreatePedidoDto): Promise<string> {
    if (!dto.productos || dto.productos.length === 0) {
      throw new BadRequestException('Debe enviar al menos un producto en el pedido');
    }

    const token = await this.obtenerTokenDeNave();

    const productosFormateados = dto.productos.map((p, index) => {
      const idLimpio = p.nombre.replace(/[^a-zA-Z0-9]/g, '') || `item${index}`;

      return {
        id: idLimpio,
        name: p.nombre,
        description: p.nombre,
        quantity: p.cantidad,
        unit_price: {
          currency: 'ARS',
          value: p.precio_unitario.toFixed(2),
        },
      };
    });

    const body = {
      platform: 'platform-x',
      store_id: 'store1-platform-x',
      callback_url: `https://platform_x.com.ar/order/${dto.external_id}`,
      order_id: dto.external_id,
      mobile: dto.mobile,
      payment_request: {
        transactions: [
          {
            products: productosFormateados,
            amount: {
              currency: 'ARS',
              value: dto.total.toFixed(2),
            },
          },
        ],
        buyer: {
          user_id: dto.email,
          doc_type: 'DNI',
          doc_number: 'N/A',
          user_email: dto.email,
          name: dto.cliente_nombre,
          phone: dto.telefono,
          billing_address: {
            street_1: dto.calle,
            street_2: 'N/A',
            city: dto.ciudad,
            region: dto.region,
            country: dto.pais,
            zipcode: dto.codigo_postal,
          },
        },
      },
    };

    const response = await fetch('https://e3-api.ranty.io/ecommerce/payment_request/external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    /* console.log('Respuesta de Nave:', result); */
    if (!response.ok) {
      throw new InternalServerErrorException(`Error en Nave: ${JSON.stringify(result)}`);
    }

    return result.data.redirect_to;
  }


  async obtenerTokenDeNave(): Promise<string> {
    const res = await fetch('https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2ms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'r7lAUUZNNuQFOYLe3v9LGyfLBagDinq2',
        client_secret: 'GFiOS-cG3p--Vo_nuKdYpXdmy8Ze-l4iTNE6wHylYdSNTBzQtqso8OQeaCMmlTJF',
        audience: 'https://naranja.com/ranty/merchants/api',
      }),
    });

    const data = await res.json();
    if (!data.access_token) {
      throw new InternalServerErrorException('Error al obtener token de Nave');
    }

    return data.access_token;
  }

  async procesarNotificacionDeNave(data: any) {
    const estadoPago = data.status;
    const externalId = data.order_id;

    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido con external_id ${externalId} no encontrado`);
    }

    if (estadoPago === 'APPROVED') {
      for (const producto of pedido.productos) {
        await this.stockService.confirmarStock(producto.nombre, producto.cantidad, 'DEPOSITO');
      }
      pedido.estado = 'APROBADO';
      await this.vtaComprobanteService.crearDesdePedido(pedido);
    } else if (['REJECTED', 'CANCELLED', 'REFUNDED'].includes(estadoPago)) {
      for (const producto of pedido.productos) {
        await this.stockService.liberarStock(producto.nombre, producto.cantidad, 'DEPOSITO');
      }
      pedido.estado = 'CANCELADO';
    }

    return this.pedidoRepo.save(pedido);
  }

  async encontrarPorExternalId(externalId: string): Promise<Pedido | null> {
    return this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });
  }
}
