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
import { PedidoItem } from './entities/pedido-item.entity';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

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
    
    private readonly configService: ConfigService,
  ) {}

  async crear(
    dto: CreatePedidoDto,
  ): Promise<{ pedido: Pedido; naveUrl: string }> {
    const productosValidados: PedidoItem[] = [];

    for (const producto of dto.productos) {
      const item = await this.stkItemRepo.findOne({
        where: { id: producto.nombre },
      });

      if (!item) {
        throw new NotFoundException(
          `Producto '${producto.nombre}' no existe en catálogo.`,
        );
      }

      await this.stockService.reservarStock(
        item.id,
        producto.cantidad,
        'DEPOSITO',
      );

      productosValidados.push({
        nombre: producto.nombre,
        cantidad: producto.cantidad,
        precio_unitario: producto.precio_unitario,
      } as PedidoItem);
    }

    const externalId = uuidv4().replace(/-/g, '');

    const pedido = this.pedidoRepo.create({
      cliente_cuit: dto.cliente_cuit,
      cliente_nombre: dto.cliente_nombre,
      external_id: externalId,
      total: dto.total,
      estado: 'PENDIENTE',
      productos: productosValidados,
    });

    const pedidoGuardado = await this.pedidoRepo.save(pedido);

    const naveUrl = await this.generarIntencionDePago({
      ...dto,
      external_id: externalId,
    });
    return { pedido: pedidoGuardado, naveUrl };
  }

  async generarIntencionDePago(
    dto: CreatePedidoDto & { external_id: string },
  ): Promise<string> {
    if (!dto.productos || dto.productos.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un producto en el pedido',
      );
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
            street_1: dto.billing_address.street,
            street_2: dto.billing_address.number,
            city: dto.billing_address.city,
            region: dto.billing_address.region,
            country: dto.billing_address.country,
            zipcode: dto.billing_address.postal_code,
          },
        },
      },
    };
    const response = await fetch(
      'https://e3-api.ranty.io/ecommerce/payment_request/external',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Error en Nave: ${JSON.stringify(result)}`,
      );
    }

    return result.data.redirect_to || result.data.checkout_url;
  }

  async obtenerTokenDeNave(): Promise<string> {
    const url = this.configService.get<string>('NAVE_AUTH_URL');
    if (!url) {
      throw new InternalServerErrorException(
        'NAVE_AUTH_URL no está configurada en las variables de entorno',
      );
    }

    const credentials = {
      client_id: 'r7lAUUZNNuQFOYLe3v9LGyfLBagDinq2',
      client_secret:
        'GFiOS-cG3p--Vo_nuKdYpXdmy8Ze-l4iTNE6wHylYdSNTBzQtqso8OQeaCMmlTJF',
      audience: 'https://naranja.com/ranty/merchants/api',
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al conectar con el servicio de Nave: ${error.message}`,
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      throw new InternalServerErrorException(
        `Respuesta no válida del servicio de Nave`,
      );
    }

    if (!response.ok || !data.access_token) {
      throw new InternalServerErrorException(
        `Error al obtener token de Nave: ${JSON.stringify(data)}`,
      );
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
      throw new NotFoundException(
        `Pedido con external_id ${externalId} no encontrado`,
      );
    }

    if (estadoPago === 'APPROVED') {
      for (const producto of pedido.productos) {
        await this.stockService.confirmarStock(
          producto.nombre,
          producto.cantidad,
          'DEPOSITO',
        );
      }
      pedido.estado = 'APROBADO';
      await this.vtaComprobanteService.crearDesdePedido(pedido);
    } else if (['REJECTED', 'CANCELLED', 'REFUNDED'].includes(estadoPago)) {
      for (const producto of pedido.productos) {
        await this.stockService.liberarStock(
          producto.nombre,
          producto.cantidad,
          'DEPOSITO',
        );
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
