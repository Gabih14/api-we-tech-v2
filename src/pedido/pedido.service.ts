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
  ) { }

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

    try {
      const naveUrl = await this.generarIntencionDePago({
        ...dto,
        external_id: externalId,
      });
      return { pedido: pedidoGuardado, naveUrl };
    } catch (err) {
      // Rollback: liberar stock y marcar pedido como cancelado
      for (const p of productosValidados) {
        try {
          await this.stockService.liberarStock(p.nombre, p.cantidad, 'DEPOSITO');
        } catch (e) {
          // log y continuar intentando liberar el resto
          console.error(`Error liberando stock de ${p.nombre}:`, e?.message || e);
        }
      }
      pedidoGuardado.estado = 'CANCELADO';
      await this.pedidoRepo.save(pedidoGuardado);
      throw err;
    }
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
        doc_number: dto.cliente_cuit.slice(2, -1), // Quita los primeros 2 y el último dígito
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

    // Fallback: usar redirect_to si existe, sino checkout_url
    return result?.redirect_to || result?.checkout_url;
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

  // 🔔 Procesar notificación (nuevo flujo)
  async procesarNotificacionDeNave(data: any) {
    const { payment_check_url, external_payment_id } = data;
    const token = await this.obtenerTokenDeNave();

    console.log(token);

    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: external_payment_id },
      relations: ['productos'],
    });
    console.log('Pedido encontrado para notificación: ', pedido);
    if (!pedido) {
      console.warn(`⚠ Pedido con ID ${external_payment_id} no encontrado.`);
      return;
    }

    // Idempotencia: si ya fue procesado, no repetir
    if (pedido.estado !== 'PENDIENTE') {
      console.log(`ℹ Pedido ${pedido.external_id} ya procesado (${pedido.estado}).`);
      return;
    }

    // Consultar estado real del pago en Nave
    const resp = await fetch(`${payment_check_url}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Respuesta de verificación de pago Nave: ', resp);
    const pago = await resp.json();
    console.log('Datos de pago obtenidos: ', pago);
    const estado = pago.status?.name ?? 'PENDING';

    switch (estado) {
      case 'APPROVED':
        pedido.estado = 'APROBADO';
        pedido.aprobado = new Date();

        // ✅ Confirmar stock
        for (const p of pedido.productos) {
          await this.stockService.confirmarStock(
            p.nombre,
            p.cantidad,
            'DEPOSITO',
          );
        }

        // ✅ Crear comprobante en Nacional Gestión
        try {
          await this.vtaComprobanteService.crearDesdePedido(pedido);
          console.log(
            `🧾 Comprobante generado para pedido ${pedido.external_id}`,
          );
        } catch (err) {
          console.error(`❌ Error al generar comprobante:`, err);
        }

        // ✅ Notificar a la secretaría por correo
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
        // Mantener PENDIENTE sin cambios
        break;
    }

    await this.pedidoRepo.save(pedido);
  }

  async encontrarPorExternalId(externalId: string): Promise<Pedido | null> {
    return this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });
  }

  private async notificarSecretaria(pedido: Pedido) {
    const email = this.configService.get<string>('SECRETARIA_EMAIL'); //separar por coma si hay varios

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
