// src/pedido/pedido.service.ts
import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ConflictException,
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
import { CobrosService } from 'src/vta-comprobante/cobros.service';

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

    private readonly cobrosService: CobrosService
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
      descuento_cupon: dto.descuento_cupon ?? null,
      codigo_cupon: dto.codigo_cupon ?? null,
      delivery_method: dto.tipo_envio,
      cliente_ubicacion: clienteUbicacion,
      observaciones_direccion: dto.observaciones || null,
      estado: 'PENDIENTE',
      productos: productosValidados,
      metodo_pago: dto.metodo_pago ?? 'online',
    });

    const pedidoGuardado = await this.pedidoRepo.save(pedido);

    // Para transferencias, retornar callback URL directamente
    if (pedidoGuardado.metodo_pago === 'transfer') {
      const callbackUrl = `https://shop.wetech.ar/checkout/callback?payment_id=${externalId}`;
      return { pedido: pedidoGuardado, naveUrl: callbackUrl };
    }

    // Para pagos online, continuar con Nave
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

    console.log('💳 Generando intención de pago...');
    console.log('POS ID:', pos_id);
    console.log('Payment URL:', paymentUrl);

    if (!pos_id || !paymentUrl) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para Nave',
      );
    }

    // 🔧 Limpiar y validar DNI
    const rawCuit = dto.cliente_cuit.replace(/\D/g, ''); // Solo números
    const docNumber = rawCuit.length === 11 ? rawCuit.slice(2, -1) : rawCuit.slice(0, 8);

    console.log('📋 CUIT original:', dto.cliente_cuit);
    console.log('📋 DNI extraído:', docNumber);

    // 🔧 Validar billing_address y usar valores por defecto si están vacíos
    const billingAddress = {
      street_1: dto.billing_address?.street || 'N/A',
      street_2: dto.billing_address?.number || 'N/A',
      city: dto.billing_address?.city || 'N/A',
      region: dto.billing_address?.region || dto.region || 'N/A',
      country: dto.billing_address?.country || dto.pais || 'AR',
      zipcode: dto.billing_address?.postal_code || dto.codigo_postal || '0000',
    };

    console.log('📍 Billing address procesado:', billingAddress);

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
        doc_number: docNumber,
        name: dto.cliente_nombre,
        user_email: dto.email,
        user_id: docNumber, // ÚLTIMO AGREGADO
        billing_address: billingAddress,
      },
      additional_info: {
        callback_url: `${callbackBase}?order_id=${dto.external_id}`,
      },
      duration_time: 3000,
    };

    console.log('📦 Body completo a enviar:', JSON.stringify(body, null, 2));

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
      console.log('📡 Respuesta de Nave (intención de pago):', response.status, response.statusText);
    } catch (error: any) {
      console.error('❌ Error de red al conectar con Nave:', error.message);
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
      console.log('📦 Respuesta completa de Nave:', JSON.stringify(result, null, 2));
    } catch {
      console.error('❌ Respuesta no es JSON válido');
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
      console.error('❌ Error de Nave:', {
        status: response.status,
        body: result
      });

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
      console.error('❌ No se encontró URL de redirección en:', result);
      throw new HttpException(
        {
          code: 'ERR_NAVE_NO_URL',
          message: 'No pudimos generar el enlace de pago. Intenta nuevamente.',
          retryable: true,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    console.log('✅ URL de pago generada exitosamente');
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
      console.log('📡 Respuesta de Nave Auth:', response.status, response.statusText);
    } catch (error: any) {
      console.error('❌ Error de red al autenticar:', error.message);
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

    console.log('📡 Token de Nave obtenido:', token);

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

    // 🚫 Bloquear webhooks para pagos por transferencia
    if (pedido.metodo_pago === 'transfer') {
      console.warn(`⚠️ Webhook recibido para pedido de transferencia ${pedido.external_id}. Las transferencias no deben procesarse por webhook.`);
      return {
        message: `Pedido ${pedido.external_id} es de tipo transferencia y no se procesa por webhook`,
        estado: pedido.estado,
      };
    }

    // Idempotencia: si ya fue procesado, no repetir
    if (pedido.estado !== 'PENDIENTE' && pedido.estado !== 'CANCELADO') {
      console.log(`ℹ Pedido ${pedido.external_id} ya procesado (${pedido.estado}).`);
      return { message: `Pedido ya procesado con estado: ${pedido.estado}`, estado: pedido.estado };
    }

    // Consultar estado real del pago en Nave
    const resp = await fetch(payment_check_url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'axios', // ✅ Header requerido por Nave
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });
    console.log('📡 Verificando estado de pago en Nave...', payment_check_url, token);
    console.log('Respuesta de verificación de pago Nave: ', resp);
    const contentType = resp.headers.get('content-type') || '';
    let pago: any = null;
    if (contentType.includes('application/json')) {
      try {
        pago = await resp.json();
      } catch (error: any) {
        console.error('❌ Error parseando JSON de verificación de pago:', error?.message || error);
        throw new HttpException(
          {
            code: 'ERR_NAVE_PAYMENT_CHECK_INVALID_JSON',
            message: 'La verificación del pago no respondió correctamente. Intenta nuevamente.',
            retryable: true,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } else {
      const raw = await resp.text();
      console.error('❌ Verificación de pago no retornó JSON:', {
        status: resp.status,
        contentType,
        body: raw?.slice(0, 500),
      });
      throw new HttpException(
        {
          code: 'ERR_NAVE_PAYMENT_CHECK_NOT_JSON',
          message: 'La verificación del pago no respondió correctamente. Intenta nuevamente.',
          retryable: true,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    console.log('Datos de pago obtenidos: ', pago);
    const estado = pago.status?.name ?? 'PENDING';

    switch (estado) {
      case 'APPROVED': {
        if (pedido.estado === 'CANCELADO') {
          console.log(`🔄 Pedido ${pedido.external_id} estaba CANCELADO. Re-reservando stock...`);
          for (const p of pedido.productos) {
            try {
              await this.stockService.reservarStock(p.nombre, p.cantidad);
            } catch (err) {
              console.error(`❌ No se pudo re-reservar stock para ${p.nombre}`, err);
              throw new ConflictException(
                `No se pudo reactivar el pedido ${pedido.external_id}: stock insuficiente para ${p.nombre}`,
              );
            }
          }
        }

        pedido.estado = 'APROBADO';
        pedido.aprobado = new Date();

        for (const p of pedido.productos) {
          await this.stockService.confirmarStock(p.nombre, p.cantidad);
        }

        let comprobanteCreado: { tipo: string; comprobante: string };

        try {
          const comp = await this.vtaComprobanteService.crearDesdePedido(pedido);
          comprobanteCreado = { tipo: comp.tipo, comprobante: comp.comprobante };
          console.log(`🧾 Comprobante generado para pedido ${pedido.external_id}:`, comprobanteCreado);
        } catch (err) {
          console.error(`❌ Error al generar comprobante para pedido ${pedido.external_id}:`, err);
          throw err; // crítico => reintento Nave
        }

        try {
          const cuentaNave = this.configService.get<string>('NAVE_CUENTA_ID') ?? 'BANCO GALICIA';
          await this.cobrosService.cobrarFactura(
            comprobanteCreado.tipo,
            comprobanteCreado.comprobante,
            { modalidad: 'CUENTA', medioId: cuentaNave, puntoVenta: '00001' },
          );
          console.log(`💰 Cobro generado OK para comprobante:`, comprobanteCreado);
        } catch (err) {
          console.error(`❌ Error al generar cobro automático para pedido ${pedido.external_id}:`, err);
          throw err; // crítico => reintento Nave
        }

        // No críticos
        try { await this.notificarSecretaria(pedido); } catch (e) { console.error('mail', e); }
        try {
          const msg = this.whatsappService.formatearMensajePedido(pedido);
          await this.whatsappService.enviarMensaje(msg);
        } catch (e) { console.error('whatsapp', e); }

        if (pedido.delivery_method === 'shipping') {
          try {
            const msg = this.whatsappService.formatearMensajeParaDelivery(pedido);
            const phone = this.configService.get<string>('DELIVERY_WHATSAPP_PHONE');
            const apiKey = this.configService.get<string>('DELIVERY_WHATSAPP_API_KEY');
            if (phone && apiKey) await this.whatsappService.enviarMensaje(msg, phone, apiKey);
          } catch (e) { console.error('delivery whatsapp', e); }
        }

        break;
      }




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

  // 💳 Aprobar pedido por transferencia
  async aprobarTransferencia(externalId: string): Promise<{ pedido: Pedido; comprobante: any }> {
    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${externalId} no encontrado`);
    }

    if (pedido.metodo_pago !== 'transfer') {
      throw new BadRequestException(`Pedido ${externalId} no es de tipo transferencia`);
    }

    if (pedido.estado !== 'PENDIENTE') {
      throw new ConflictException(`Pedido ${externalId} ya fue procesado (estado: ${pedido.estado})`);
    }

    // Verificar y confirmar stock
    for (const p of pedido.productos) {
      try {
        await this.stockService.confirmarStock(p.nombre, p.cantidad);
      } catch (err) {
        console.error(`❌ No se pudo confirmar stock para ${p.nombre}`, err);
        throw new ConflictException(
          `Stock insuficiente para ${p.nombre}. El pedido no puede ser aprobado.`,
        );
      }
    }

    // Actualizar estado
    pedido.estado = 'APROBADO';
    pedido.aprobado = new Date();

    // Crear comprobante con método de pago 'transfer'
    let comprobanteCreado: any;
    try {
      const comp = await this.vtaComprobanteService.crearDesdePedido(pedido);
      comprobanteCreado = { tipo: comp.tipo, comprobante: comp.comprobante };
      console.log(`🧾 Comprobante generado para pedido transferencia ${pedido.external_id}:`, comprobanteCreado);
    } catch (err) {
      console.error(`❌ Error al generar comprobante para pedido ${pedido.external_id}:`, err);
      throw err;
    }

    // NO generar cobro para transferencias

    // Guardar pedido actualizado
    await this.pedidoRepo.save(pedido);

    // Notificaciones no críticas
    try { await this.notificarSecretaria(pedido); } catch (e) { console.error('mail', e); }
    try {
      const msg = this.whatsappService.formatearMensajePedido(pedido);
      await this.whatsappService.enviarMensaje(msg);
    } catch (e) { console.error('whatsapp', e); }

    if (pedido.delivery_method === 'shipping') {
      try {
        const msg = this.whatsappService.formatearMensajeParaDelivery(pedido);
        const phone = this.configService.get<string>('DELIVERY_WHATSAPP_PHONE');
        const apiKey = this.configService.get<string>('DELIVERY_WHATSAPP_API_KEY');
        if (phone && apiKey) await this.whatsappService.enviarMensaje(msg, phone, apiKey);
      } catch (e) { console.error('delivery whatsapp', e); }
    }

    return { pedido, comprobante: comprobanteCreado };
  }

  // ❌ Rechazar pedido por transferencia
  async rechazarTransferencia(externalId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${externalId} no encontrado`);
    }

    if (pedido.metodo_pago !== 'transfer') {
      throw new BadRequestException(`Pedido ${externalId} no es de tipo transferencia`);
    }

    if (pedido.estado !== 'PENDIENTE') {
      throw new ConflictException(`Pedido ${externalId} ya fue procesado (estado: ${pedido.estado})`);
    }

    // Liberar stock
    for (const p of pedido.productos) {
      try {
        await this.stockService.liberarStock(p.nombre, p.cantidad);
      } catch (err) {
        console.error(`❌ Error liberando stock de ${p.nombre}:`, err);
      }
    }

    // Actualizar estado
    pedido.estado = 'CANCELADO';
    await this.pedidoRepo.save(pedido);

    console.log(`✅ Pedido transferencia ${externalId} rechazado manualmente`);

    return pedido;
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
        <div><strong>Observaciones:</strong> ${pedido.observaciones_direccion || 'Ninguna'}</div>
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
