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
import { MailerService } from 'src/mailer/mailer.service';

@Injectable()
export class PedidoService {
  constructor(
    @InjectRepository(Pedido, 'back') // 👈 Base de datos propia
    private readonly pedidoRepo: Repository<Pedido>,

    @InjectRepository(StkItem) // 👈 Viene de la base original
    private readonly stkItemRepo: Repository<StkItem>,

    @Inject(forwardRef(() => StkExistenciaService))
    private readonly stockService: StkExistenciaService,

    @Inject(forwardRef(() => VtaComprobanteService))
    private readonly vtaComprobanteService: VtaComprobanteService,

    private readonly configService: ConfigService,

    private readonly mailerService: MailerService,
  ) {}

  // 🧾 Crear pedido e intención de pago
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

  // 💳 Generar intención de pago (nueva API)
  async generarIntencionDePago(
    dto: CreatePedidoDto & { external_id: string },
  ): Promise<string> {
    const token = await this.obtenerTokenDeNave();

    const pos_id = this.configService.get<string>('NAVE_POS_ID');
    const paymentUrl = this.configService.get<string>('NAVE_PAYMENT_URL');
    const callbackBase = this.configService.get<string>('CALLBACK_URL');

    if (!pos_id || !paymentUrl) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para Nave',
      );
    }

    const body = {
      external_payment_id: dto.external_id,
      seller: { pos_id },
      transactions: [
        {
          amount: { currency: 'ARS', value: dto.total.toFixed(2) },
          products: dto.productos.map((p) => ({
            name: p.nombre,
            description: p.nombre,
            quantity: p.cantidad,
            unit_price: {
              currency: 'ARS',
              value: p.precio_unitario.toFixed(2),
            },
          })),
        },
      ],
      buyer: {
        doc_type: 'DNI',
        doc_number: 'N/A',
        name: dto.cliente_nombre,
        user_email: dto.email,
        billing_address: {
          street_1: dto.billing_address.street,
          street_2: dto.billing_address.number,
          city: dto.billing_address.city,
          region: dto.billing_address.region,
          country: dto.billing_address.country,
          zipcode: dto.billing_address.postal_code,
        },
      },
      additional_info: {
        callback_url: `${callbackBase}?order_id=${dto.external_id}`,
      },
      duration_time: 3000,
    };

    const response = await fetch(paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Error en Nave: ${JSON.stringify(result)}`,
      );
    }

    return result.checkout_url;
  }

  // 🔐 Obtener token Nave (nuevo endpoint)
  async obtenerTokenDeNave(): Promise<string> {
    const url = this.configService.get<string>('NAVE_AUTH_URL');
    const client_id = this.configService.get<string>('CLIENT_ID');
    const client_secret = this.configService.get<string>('CLIENT_SECRET');
    const audience = this.configService.get<string>('NAVE_AUDIENCE');

    if (!url || !client_id || !client_secret || !audience) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para la autenticación de Nave',
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, client_secret, audience }),
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
      throw new InternalServerErrorException(
        `Error al obtener token de Nave: ${JSON.stringify(data)}`,
      );
    }

    return data.access_token;
  }

  // 🔔 Procesar notificación (nuevo flujo Nave)
  async procesarNotificacionDeNave(data: any) {
    try {
      const { payment_check_url, external_payment_id } = data;

      if (!payment_check_url || !external_payment_id) {
        console.warn('⚠️ Webhook inválido: faltan campos requeridos:', data);
        return;
      }

      // 🔐 Obtener token de Nave
      const token = await this.obtenerTokenDeNave();

      // 🧾 Buscar pedido por external_id
      const pedido = await this.pedidoRepo.findOne({
        where: { external_id: external_payment_id },
        relations: ['productos'],
      });

      if (!pedido) {
        console.warn(
          `⚠️ Pedido con external_id ${external_payment_id} no encontrado.`,
        );
        return;
      }

      // 🔍 Consultar estado real del pago
      const url = payment_check_url.startsWith('http')
        ? payment_check_url
        : `https://${payment_check_url}`;

      console.log(`🌐 Consultando estado de pago en Nave: ${url}`);

      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error(`❌ Error al consultar Nave (${resp.status}): ${text}`);
        throw new Error(`Nave respondió con ${resp.status}`);
      }

      const pago = await resp.json();
      const estado = pago.status?.name ?? 'PENDING';
      console.log(`💳 Estado recibido de Nave: ${estado}`);

      // 🔄 Actualizar estado del pedido según respuesta de Nave
      switch (estado) {
        case 'APPROVED':
          pedido.estado = 'APROBADO';
          pedido.aprobado = new Date();
          for (const p of pedido.productos) {
            await this.stockService.confirmarStock(
              p.nombre,
              p.cantidad,
              'DEPOSITO',
            );
          }
          await this.notificarSecretaria(pedido);
          break;

        case 'REJECTED':
        case 'CANCELLED':
        case 'REFUNDED':
          pedido.estado = 'CANCELADO';
          for (const p of pedido.productos) {
            await this.stockService.liberarStock(
              p.nombre,
              p.cantidad,
              'DEPOSITO',
            );
          }
          break;

        default:
          pedido.estado = 'PENDIENTE';
          break;
      }

      // 💾 Guardar cambios en la base
      await this.pedidoRepo.save(pedido);

      console.log(
        `✅ Pedido ${pedido.external_id} actualizado a estado ${pedido.estado}`,
      );
    } catch (err) {
      console.error('🚨 Error procesando notificación de Nave:', err);
    }
  }

  async encontrarPorExternalId(externalId: string): Promise<Pedido | null> {
    return this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });
  }

  private async notificarSecretaria(pedido: Pedido) {
    const email = this.configService.get<string>('SECRETARIA_EMAIL');

    const mensaje = `🧾 Pedido Aprobado
Cliente: ${pedido.cliente_nombre}
CUIT: ${pedido.cliente_cuit}

Productos:
${pedido.productos.map((p) => `- ${p.nombre} x${p.cantidad} ($${p.precio_unitario})`).join('\n')}

Total: $${pedido.total}
`;

    if (!email)
      throw new InternalServerErrorException('Falta el email de secretaria');

    await this.mailerService.enviarCorreo(
      email,
      '📦 Pedido Aprobado en WeTech',
      mensaje,
    );
  }
}
