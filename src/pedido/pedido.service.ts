// src/pedido/pedido.service.ts
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
  HttpStatus,
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
import { WhatsappService } from 'src/whatsapp/whatsapp.service';

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

    private readonly whatsappService: WhatsappService,
  ) { }

  // 🧾 Crear pedido e intención de pago
  async crear(
    dto: CreatePedidoDto,
  ): Promise<{ pedido: Pedido; naveUrl: string }> {
    if (!dto.productos || dto.productos.length === 0) {
      throw new HttpException(
        {
          code: 'ERR_VALIDATION_PRODUCTS',
          message: 'Debes incluir al menos un producto.',
          retryable: false,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
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
      );

      productosValidados.push({
        nombre: producto.nombre,
        descripcion: item.descripcion,
        cantidad: producto.cantidad,
        precio_unitario: producto.precio_unitario,
      } as PedidoItem);
    }

    const externalId = uuidv4().replace(/-/g, '');
    const clienteUbicacion = dto.billing_address
      ? `${dto.billing_address.street} ${dto.billing_address.number}, ${dto.billing_address.city}, ${dto.billing_address.region}, ${dto.billing_address.country}, ${dto.billing_address.postal_code}`
      : `${dto.calle || ''} ${dto.ciudad || ''}`.trim();

    const pedido = this.pedidoRepo.create({
      cliente_cuit: dto.cliente_cuit,
      cliente_nombre: dto.cliente_nombre,
      cliente_mail: dto.email,
      external_id: externalId,
      total: dto.total,
      costo_envio: dto.costo_envio,
      delivery_method: dto.tipo_envio,
      cliente_ubicacion: clienteUbicacion,
      observaciones_direccion: dto.observaciones || null,
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
          await this.stockService.liberarStock(p.nombre, p.cantidad);
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

    let response: Response;
    try {
      response = await fetch(paymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error: any) {
      // Fallo de red / Nave caído
      throw new HttpException(
        {
          code: 'ERR_NAVE_UNAVAILABLE',
          message: 'El servicio de pagos está con problemas. Vuelve más tarde.',
          retryable: false,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new HttpException(
        {
          code: 'ERR_NAVE_INVALID_RESPONSE',
          message: 'El servicio de pagos no respondió correctamente. Vuelve más tarde.',
          retryable: false,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        {
          code: 'ERR_NAVE_BAD_RESPONSE',
          message: 'No pudimos procesar el pago. Intenta nuevamente.',
          retryable: true,
          details: result,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const url = result?.redirect_to || result?.checkout_url;
    if (!url) {
      throw new HttpException(
        {
          code: 'ERR_NAVE_NO_URL',
          message: 'No pudimos generar el enlace de pago. Intenta nuevamente.',
          retryable: true,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return url;
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

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, client_secret, audience }),
      });
    } catch (error: any) {
      throw new HttpException(
        {
          code: 'ERR_NAVE_AUTH_UNAVAILABLE',
          message: 'El servicio de autenticación de pagos está con problemas. Vuelve más tarde.',
          retryable: false,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new HttpException(
        {
          code: 'ERR_NAVE_AUTH_INVALID_RESPONSE',
          message: 'Autenticación de pagos no respondió correctamente. Vuelve más tarde.',
          retryable: false,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok || !data.access_token) {
      throw new HttpException(
        {
          code: 'ERR_NAVE_AUTH_FAILED',
          message: 'No pudimos autenticarte para el pago. Intenta nuevamente.',
          retryable: true,
          details: data,
        },
        HttpStatus.BAD_GATEWAY,
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
    
    // ✅ VALIDACIÓN: Si no existe el pedido, rechazar la notificación
    if (!pedido) {
      console.error(`❌ Pedido con ID ${external_payment_id} no encontrado en esta base de datos.`);
      throw new NotFoundException(
        `Pedido ${external_payment_id} no encontrado. Posiblemente fue creado en otro ambiente.`
      );
    }

    console.log('Pedido encontrado para notificación: ', pedido);

    // Idempotencia: si ya fue procesado, no repetir
    if (pedido.estado !== 'PENDIENTE') {
      console.log(`ℹ Pedido ${pedido.external_id} ya procesado (${pedido.estado}).`);
      return { message: `Pedido ya procesado con estado: ${pedido.estado}`, estado: pedido.estado };
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

        for (const p of pedido.productos) {
          await this.stockService.confirmarStock(p.nombre, p.cantidad);
        }

        try {
          await this.vtaComprobanteService.crearDesdePedido(pedido);
          console.log(`🧾 Comprobante generado para pedido ${pedido.external_id}`);
        } catch (err) {
          console.error(`❌ Error al generar comprobante:`, err);
        }

        // ✅ Notificar a la secretaría por correo
        await this.notificarSecretaria(pedido);

        // ✅ Notificar por WhatsApp
        try {
          const mensaje = this.whatsappService.formatearMensajePedido(pedido);
          await this.whatsappService.enviarMensaje(mensaje);
        } catch (err) {
          console.error(`❌ Error al enviar WhatsApp:`, err);
          // No lanzar error para que no afecte el flujo principal
        }

        // ✅ Notificar al servicio de delivery (teléfono y apiKey desde env)
        try {
          const mensajeDelivery = this.whatsappService.formatearMensajeParaDelivery(pedido);
          const deliveryPhone = this.configService.get<string>('DELIVERY_WHATSAPP_PHONE');
          const deliveryApiKey = this.configService.get<string>('DELIVERY_WHATSAPP_API_KEY');
          if (deliveryPhone && deliveryApiKey) {
            await this.whatsappService.enviarMensaje(mensajeDelivery, deliveryPhone, deliveryApiKey);
          } else {
            console.warn('No se enviará WhatsApp a delivery: faltan DELIVERY_WHATSAPP_PHONE o DELIVERY_WHATSAPP_API_KEY');
          }
        } catch (err) {
          console.error(`❌ Error al enviar WhatsApp a delivery:`, err);
        }
        break;

      case 'REJECTED':
      case 'CANCELLED':
      case 'REFUNDED':
        pedido.estado = 'CANCELADO';
        for (const p of pedido.productos) {
          await this.stockService.liberarStock(
            p.nombre,
            p.cantidad,
          );
        }
        break;

      default:
        console.log(`ℹ Estado ${estado} no requiere acción, manteniendo PENDIENTE`);
        break;
    }

    await this.pedidoRepo.save(pedido);
    
    return {
      message: `Pedido ${pedido.external_id} procesado correctamente`,
      estado: pedido.estado
    };
  }

  async encontrarPorExternalId(externalId: string): Promise<Pedido | null> {
    return this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });
  }

  private async notificarSecretaria(pedido: Pedido) {
    const secretariaEmail = this.configService.get<string>('SECRETARIA_EMAIL');
    const destinatarios = `${secretariaEmail}, ${pedido.cliente_mail}`;

    if (!secretariaEmail) {
      throw new InternalServerErrorException('Falta el email de secretaria');
    }

    // Lista de productos en HTML
    const productosHtml = pedido.productos
      .map(
        (p) => `
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="vertical-align: top;">
            <td style="padding: 16px 8px 0 0; width: 100%;">
              <div>${p.nombre}</div>
              <div style="font-size: 14px; color: #888; padding-top: 4px;">Cantidad: ${p.cantidad}</div>
            </td>
            <td style="padding: 16px 4px 0 0; white-space: nowrap; text-align: right;">
              <strong>$${p.precio_unitario.toFixed(2)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    `,
      )
      .join('');

    const htmlMensaje = `
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #333; padding: 14px 8px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: auto; background-color: #fff;">
    <!-- Encabezado con logo -->
    <div style="border-top: 6px solid #458500; padding: 16px;">
      <a style="text-decoration: none; outline: none; margin-right: 8px; vertical-align: middle;" href="https://shop.wetech.ar" target="_blank" rel="noopener">
        <img src="https://shop.wetech.ar/assets/Logo%20WeTECH%20Negro%20PNG-CPBuO7yQ.png" width="103" height="41" alt="WeTECH Logo">
      </a>
      <span style="font-size: 16px; vertical-align: middle; border-left: 1px solid #333; padding-left: 8px;">
        <strong>Pedido Aprobado</strong>
      </span>
    </div>

    <!-- Contenido principal -->
    <div style="padding: 0 16px;">
      <p>Estimado/a <strong>${pedido.cliente_nombre}</strong>,<br>
      hemos recibido y aprobado su pedido. A continuación, los detalles:</p>

      <!-- Datos del cliente -->
      <div style="margin: 16px 0; font-size: 14px; color: #555;">
        <div><strong>Cliente:</strong> ${pedido.cliente_nombre}</div>
        <div><strong>CUIT:</strong> ${pedido.cliente_cuit}</div>
        <div><strong>Ubicación:</strong> ${pedido.cliente_ubicacion || 'No especificada'}</div>
        <div><strong>Tipo de envío:</strong> ${pedido.delivery_method || 'pickup'}</div>
        <div><strong>Costo de envío:</strong> $${pedido.costo_envio != null ? Number(pedido.costo_envio).toFixed(2) : '0.00'}</div>
      </div>

      <!-- Productos -->
      <div style="text-align: left; font-size: 14px; padding-bottom: 4px; border-bottom: 2px solid #333;">
        <strong>Detalles del Pedido</strong>
      </div>

      ${productosHtml}

      <!-- Total -->
      <div style="padding: 24px 0;">
        <div style="border-top: 2px solid #333;">&nbsp;</div>
      </div>
      <table style="border-collapse: collapse; width: 100%; text-align: right;">
        <tbody>
          <tr>
            <td style="width: 60%;">&nbsp;</td>
            <td style="border-top: 2px solid #333;">
              <strong style="white-space: nowrap;">Total del Pedido</strong>
            </td>
            <td style="padding: 16px 8px; border-top: 2px solid #333; white-space: nowrap;">
              <strong>$${pedido.total.toFixed(2)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div style="max-width: 600px; margin: auto; padding: 12px; text-align: center;">
    <p style="color: #999; font-size: 12px;">
      Este correo fue enviado a ${pedido.cliente_mail}<br>
      Usted recibió este correo porque realizó un pedido en WeTECH
    </p>
  </div>
</div>
    `;

    await this.mailerService.enviarCorreo(
      destinatarios,
      '📦 Pedido Aprobado en WeTech',
      htmlMensaje,
    );
  }
}
