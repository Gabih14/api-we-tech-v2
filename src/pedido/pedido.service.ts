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
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pedido } from './entities/pedido.entity';
import { Brackets, Repository } from 'typeorm';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';
import { VtaComprobanteService } from 'src/vta-comprobante/vta-comprobante.service';
import { PedidoItem } from './entities/pedido-item.entity';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { MailerService } from 'src/mailer/mailer.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { CobrosService } from 'src/vta-comprobante/cobros.service';
import { GetPedidosDashboardDto } from './dto/get-pedidos-dashboard.dto';
import { CuponService } from 'src/cupon/cupon.service';
import {
  getDiscountPercentageForProduct,
  isEligibleForQuantityDiscount,
  parseProductWeightFromDescription,
} from 'src/pricing/discounts';

type PedidoMetodoPago = 'online' | 'transfer';

const FREE_SHIPPING_MIN_WEIGHT_KG = 10;
const ONLINE_QUANTITY_DISCOUNT_MIN_QUANTITY = 5;
const ALERTA_IMPORTES_EMAIL = 'virtual.hache@gmail.com';
// TODO impresoras: cuando se vendan por la web, no deben usar IVA 21%.
// Las impresoras tributan 10.5%, por lo que hay que resolver la alicuota por producto.
const FACTURA_IVA_PORCENTAJE = 21;

interface PedidoProductoCalculado {
  nombre: string;
  cantidad: number;
  precio_base_unitario: number;
  precio_unitario: number;
  subtotal: number;
  ajuste_porcentaje: number | null;
  descuento_cupon_aplicado: number;
}

interface PedidoProductoMismatch {
  nombre: string;
  expected: {
    precio_unitario?: number;
    subtotal?: number;
  };
  received: {
    precio_unitario?: number;
    subtotal?: number;
  };
}

interface PedidoProductoPrecargado {
  producto: CreatePedidoDto['productos'][number];
  item: StkItem;
  peso?: number;
  esProductoEnvio: boolean;
  aplicaDescuentoDiferencialPorCantidad: boolean;
}

@Injectable()
export class PedidoService {
  private readonly logger = new Logger(PedidoService.name);

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

    private readonly telegramService: TelegramService,

    private readonly cobrosService: CobrosService,

    private readonly cuponService: CuponService,
  ) {}

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

    if (dto.codigo_cupon) {
      await this.cuponService.validarUsoCupon({
        cupon_id: dto.codigo_cupon,
        cuit: dto.cliente_cuit,
      });
    }

    const metodoPago = dto.metodo_pago ?? 'online';
    const facturaTipo =
      dto.factura_tipo === 'A' || dto.factura_tipo === 'B'
        ? dto.factura_tipo
        : null;
    const requiereFactura = facturaTipo !== null;
    const porcentajeCupon = await this.resolverPorcentajeCupon(
      dto.codigo_cupon,
      metodoPago,
    );
    const productosPrecargados: PedidoProductoPrecargado[] = [];
    let cantidadTotalDescuentoDiferencial = 0;
    const productosCalculados: PedidoProductoCalculado[] = [];
    const productosValidados: PedidoItem[] = [];
    const diferenciasProductos: PedidoProductoMismatch[] = [];
    let pesoTotalKg = 0;

    for (const producto of dto.productos) {
      const item = await this.stkItemRepo.findOne({
        where: { id: producto.nombre },
        relations: ['stkPrecios', 'stkPrecios.moneda'],
      });

      if (!item) {
        throw new NotFoundException(
          `Producto '${producto.nombre}' no existe en catálogo.`,
        );
      }

      const cantidad = this.obtenerCantidadProducto(producto);
      const esProductoEnvio = this.esProductoEnvio(producto.nombre);
      const peso = esProductoEnvio
        ? undefined
        : parseProductWeightFromDescription(item.descripcion);
      if (!esProductoEnvio) {
        pesoTotalKg += (peso ?? 0) * cantidad;
      }
      const productoDescuento = {
        id: item.id,
        category: item.grupo,
      };
      const aplicaDescuentoDiferencialPorCantidad =
        !esProductoEnvio &&
        isEligibleForQuantityDiscount(productoDescuento, peso ?? 0);

      if (aplicaDescuentoDiferencialPorCantidad) {
        cantidadTotalDescuentoDiferencial += cantidad;
      }

      productosPrecargados.push({
        producto,
        item,
        peso,
        esProductoEnvio,
        aplicaDescuentoDiferencialPorCantidad,
      });
    }

    for (const {
      producto,
      item,
      peso,
      esProductoEnvio,
      aplicaDescuentoDiferencialPorCantidad,
    } of productosPrecargados) {
      const cantidadParaDescuento = aplicaDescuentoDiferencialPorCantidad
        ? cantidadTotalDescuentoDiferencial
        : undefined;
      const productoCalculado = this.calcularProductoPedido(
        producto,
        item,
        porcentajeCupon,
        metodoPago,
        peso,
        cantidadParaDescuento,
        esProductoEnvio,
        requiereFactura,
      );
      const diferenciaProducto = this.obtenerDiferenciaProducto(
        producto,
        productoCalculado,
        requiereFactura,
      );

      if (diferenciaProducto) {
        diferenciasProductos.push(diferenciaProducto);
      }

      productosCalculados.push(productoCalculado);
      productosValidados.push(
        this.pedidoItemDesdeCalculo(productoCalculado, item.descripcion),
      );
    }

    const productosNetos = this.redondearPrecio(
      productosValidados.reduce(
        (acc, producto) => acc + Number(producto.subtotal ?? 0),
        0,
      ),
    );
    const descuentoCupon = this.redondearPrecio(
      productosCalculados.reduce(
        (acc, producto) => acc + producto.descuento_cupon_aplicado,
        0,
      ),
    );
    const costoEnvioDesdeProducto =
      this.obtenerCostoEnvioDesdeProductos(productosValidados);
    const costoEnvioCalculado =
      costoEnvioDesdeProducto ??
      this.calcularCostoEnvioPedido(dto, pesoTotalKg);
    const costoEnvioAdicional = costoEnvioDesdeProducto == null
      ? costoEnvioCalculado
      : 0;
    const subtotalSinIva = this.redondearPrecio(
      productosNetos + costoEnvioAdicional,
    );
    const facturaIvaImporte = facturaTipo
      ? this.calcularIvaFacturaImporte(subtotalSinIva)
      : null;
    const totalCalculado = subtotalSinIva + (facturaIvaImporte ?? 0);

    await this.validarTotalesRecibidos(dto, {
      total: totalCalculado,
      descuento_cupon: descuentoCupon,
      productos: diferenciasProductos,
      costo_envio: costoEnvioCalculado,
      subtotal_sin_iva: subtotalSinIva,
      factura_iva_importe: facturaIvaImporte,
    });

    for (const p of productosValidados) {
      await this.stockService.reservarStock(p.nombre, p.cantidad);
    }

    const externalId = uuidv4().replace(/-/g, '');
    const callePedido = dto.calle || dto.billing_address?.street || '';
    const direccionPedido = {
      calle: callePedido,
      numero: dto.calle ? '' : dto.billing_address?.number || '',
      ciudad: dto.ciudad || dto.billing_address?.city || '',
      region: dto.region || dto.billing_address?.region || '',
      pais: dto.pais || dto.billing_address?.country || '',
      codigoPostal: dto.codigo_postal || dto.billing_address?.postal_code || '',
    };
    const ubicacionDesdeDireccion = dto.direccion?.trim();
    const ubicacionDesdePartes = [
      `${direccionPedido.calle} ${direccionPedido.numero}`.trim(),
      direccionPedido.ciudad,
      direccionPedido.region,
      direccionPedido.pais,
      direccionPedido.codigoPostal,
    ]
      .filter(Boolean)
      .join(', ');
    const clienteUbicacion = ubicacionDesdeDireccion || ubicacionDesdePartes;

    const pedido = this.pedidoRepo.create({
      cliente_cuit: dto.cliente_cuit,
      cliente_nombre: dto.cliente_nombre,
      cliente_mail: dto.email,
      external_id: externalId,
      total: totalCalculado,
      costo_envio: costoEnvioCalculado,
      descuento_cupon: descuentoCupon || undefined,
      codigo_cupon: dto.codigo_cupon ?? undefined,
      delivery_method: dto.tipo_envio,
      cliente_ubicacion: clienteUbicacion,
      observaciones_direccion: dto.observaciones || undefined,
      telefono: dto.telefono || undefined,
      estado: 'PENDIENTE',
      productos: productosValidados,
      metodo_pago: metodoPago,
      factura_tipo: facturaTipo,
      factura_iva_porcentaje: facturaTipo ? FACTURA_IVA_PORCENTAJE : null,
      factura_iva_importe: facturaIvaImporte,
    });

    const pedidoGuardado = await this.pedidoRepo.save(pedido);

    // Para transferencias, generar comprobante pendiente sin cobro
    if (pedidoGuardado.metodo_pago === 'transfer') {
      try {
        const comp =
          await this.vtaComprobanteService.crearDesdePedido(pedidoGuardado);
        pedidoGuardado.comprobante_tipo = comp.tipo;
        pedidoGuardado.comprobante_numero = comp.comprobante;
        await this.pedidoRepo.save(pedidoGuardado);
      } catch (err) {
        for (const p of productosValidados) {
          try {
            await this.stockService.liberarStock(p.nombre, p.cantidad);
          } catch (e) {
            console.error(
              `Error liberando stock de ${p.nombre}:`,
              e instanceof Error ? e.message : e,
            );
          }
        }
        pedidoGuardado.estado = 'CANCELADO';
        await this.pedidoRepo.save(pedidoGuardado);
        throw err;
      }

      try {
        await this.notificarTransferenciaPendiente(pedidoGuardado);
      } catch (e) {
        console.error('mail transferencia pendiente', e);
      }

      // WhatsApp desactivado temporalmente. Reactivar si se quiere volver a notificar por este canal.
      // try {
      //   const msg = this.whatsappService.formatearMensajeTransferenciaPendiente(pedidoGuardado);
      //   await this.whatsappService.enviarMensaje(msg);
      // } catch (e) {
      //   console.error('whatsapp transferencia pendiente', e);
      // }

      try {
        const msg =
          this.whatsappService.formatearMensajeTransferenciaPendiente(
            pedidoGuardado,
          );
        await this.telegramService.enviarMensaje(msg);
      } catch (e) {
        console.error('telegram transferencia pendiente', e);
      }

      const callbackUrl = `https://shop.wetech.ar/checkout/callback?payment_id=${externalId}`;
      return { pedido: pedidoGuardado, naveUrl: callbackUrl };
    }

    // Para pagos online, continuar con Nave
    try {
      const naveUrl = await this.generarIntencionDePago({
        ...dto,
        total: totalCalculado,
        costo_envio: costoEnvioCalculado,
        descuento_cupon: descuentoCupon,
        metodo_pago: metodoPago,
        productos: productosValidados.map((producto) => ({
          nombre: producto.nombre,
          cantidad: producto.cantidad,
          precio_unitario: producto.precio_unitario,
          subtotal: Number(producto.subtotal),
          ajuste_porcentaje: producto.ajuste_porcentaje ?? undefined,
        })),
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
          console.error(
            `Error liberando stock de ${p.nombre}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }
      pedidoGuardado.estado = 'CANCELADO';
      await this.pedidoRepo.save(pedidoGuardado);
      throw err;
    }
  }

  // 💳 Generar intención de pago (nueva API)
  async generarIntencionDePago(
    dto: CreatePedidoDto & {
      external_id: string;
      total: number;
      productos: Array<
        CreatePedidoDto['productos'][number] & {
          precio_unitario: number;
          subtotal: number;
        }
      >;
    },
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
    const docNumber =
      rawCuit.length === 11 ? rawCuit.slice(2, -1) : rawCuit.slice(0, 8);

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
              value: Number(p.precio_unitario).toFixed(2),
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
      console.log(
        '📡 Respuesta de Nave (intención de pago):',
        response.status,
        response.statusText,
      );
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
      console.log(
        '📦 Respuesta completa de Nave:',
        JSON.stringify(result, null, 2),
      );
    } catch {
      console.error('❌ Respuesta no es JSON válido');
      throw new HttpException(
        {
          code: 'ERR_NAVE_INVALID_RESPONSE',
          message:
            'El servicio de pagos no respondió correctamente. Vuelve más tarde.',
          retryable: false,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      console.error('❌ Error de Nave:', {
        status: response.status,
        body: result,
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
      console.log(
        '📡 Respuesta de Nave Auth:',
        response.status,
        response.statusText,
      );
    } catch (error: any) {
      console.error('❌ Error de red al autenticar:', error.message);
      throw new HttpException(
        {
          code: 'ERR_NAVE_AUTH_UNAVAILABLE',
          message:
            'El servicio de autenticación de pagos está con problemas. Vuelve más tarde.',
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
          message:
            'Autenticación de pagos no respondió correctamente. Vuelve más tarde.',
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
      console.error(
        `❌ Pedido con ID ${external_payment_id} no encontrado en esta base de datos.`,
      );
      throw new NotFoundException(
        `Pedido ${external_payment_id} no encontrado. Posiblemente fue creado en otro ambiente.`,
      );
    }

    console.log('Pedido encontrado para notificación: ', pedido);

    // 🚫 Bloquear webhooks para pagos por transferencia
    if (pedido.metodo_pago === 'transfer') {
      console.warn(
        `⚠️ Webhook recibido para pedido de transferencia ${pedido.external_id}. Las transferencias no deben procesarse por webhook.`,
      );
      return {
        message: `Pedido ${pedido.external_id} es de tipo transferencia y no se procesa por webhook`,
        estado: pedido.estado,
      };
    }

    // Idempotencia: si ya fue procesado, no repetir
    if (pedido.estado !== 'PENDIENTE' && pedido.estado !== 'CANCELADO') {
      console.log(
        `ℹ Pedido ${pedido.external_id} ya procesado (${pedido.estado}).`,
      );
      return {
        message: `Pedido ya procesado con estado: ${pedido.estado}`,
        estado: pedido.estado,
      };
    }

    // Consultar estado real del pago en Nave
    const resp = await fetch(payment_check_url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'axios', // ✅ Header requerido por Nave
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    console.log(
      '📡 Verificando estado de pago en Nave...',
      payment_check_url,
      token,
    );
    console.log('Respuesta de verificación de pago Nave: ', resp);
    const contentType = resp.headers.get('content-type') || '';
    let pago: any = null;
    if (contentType.includes('application/json')) {
      try {
        pago = await resp.json();
      } catch (error: any) {
        console.error(
          '❌ Error parseando JSON de verificación de pago:',
          error?.message || error,
        );
        throw new HttpException(
          {
            code: 'ERR_NAVE_PAYMENT_CHECK_INVALID_JSON',
            message:
              'La verificación del pago no respondió correctamente. Intenta nuevamente.',
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
          message:
            'La verificación del pago no respondió correctamente. Intenta nuevamente.',
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
          console.log(
            `🔄 Pedido ${pedido.external_id} estaba CANCELADO. Re-reservando stock...`,
          );
          for (const p of pedido.productos) {
            try {
              await this.stockService.reservarStock(p.nombre, p.cantidad);
            } catch (err) {
              console.error(
                `❌ No se pudo re-reservar stock para ${p.nombre}`,
                err,
              );
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
          const comp =
            await this.vtaComprobanteService.crearDesdePedido(pedido);
          comprobanteCreado = {
            tipo: comp.tipo,
            comprobante: comp.comprobante,
          };
          pedido.comprobante_tipo = comp.tipo;
          pedido.comprobante_numero = comp.comprobante;
          console.log(
            `🧾 Comprobante generado para pedido ${pedido.external_id}:`,
            comprobanteCreado,
          );
        } catch (err) {
          console.error(
            `❌ Error al generar comprobante para pedido ${pedido.external_id}:`,
            err,
          );
          throw err; // crítico => reintento Nave
        }

        try {
          const cuentaNave =
            this.configService.get<string>('NAVE_CUENTA_ID') ?? 'BANCOGALICIA';
          await this.cobrosService.cobrarFactura(
            comprobanteCreado.tipo,
            comprobanteCreado.comprobante,
            { modalidad: 'CUENTA', medioId: cuentaNave, puntoVenta: '00001' },
          );
          console.log(
            `💰 Cobro generado OK para comprobante:`,
            comprobanteCreado,
          );
        } catch (err) {
          console.error(
            `❌ Error al generar cobro automático para pedido ${pedido.external_id}:`,
            err,
          );
          throw err; // crítico => reintento Nave
        }

        // No críticos
        try {
          await this.notificarSecretaria(pedido);
        } catch (e) {
          console.error('mail', e);
        }
        // WhatsApp desactivado temporalmente. Reactivar si se quiere volver a notificar por este canal.
        // try {
        //   const msg = this.whatsappService.formatearMensajePedido(pedido);
        //   await this.whatsappService.enviarMensaje(msg);
        // } catch (e) { console.error('whatsapp', e); }

        try {
          const msg = this.whatsappService.formatearMensajePedido(pedido);
          await this.telegramService.enviarMensaje(msg);
        } catch (e) {
          console.error('telegram', e);
        }

        if (pedido.delivery_method === 'shipping') {
          // WhatsApp delivery desactivado temporalmente. Reactivar si se quiere volver a notificar por este canal.
          // try {
          //   const msg = this.whatsappService.formatearMensajeParaDelivery(pedido);
          //   const phone = this.configService.get<string>('DELIVERY_WHATSAPP_PHONE');
          //   const apiKey = this.configService.get<string>('DELIVERY_WHATSAPP_API_KEY');
          //   if (phone && apiKey) await this.whatsappService.enviarMensaje(msg, phone, apiKey);
          // } catch (e) { console.error('delivery whatsapp', e); }

          try {
            const msg =
              this.whatsappService.formatearMensajeParaDelivery(pedido);
            await this.telegramService.enviarMensajeDelivery(msg);
          } catch (e) {
            console.error('delivery telegram', e);
          }
        }

        break;
      }

      case 'REJECTED':
      case 'CANCELLED':
      case 'REFUNDED':
        pedido.estado = 'CANCELADO';
        for (const p of pedido.productos) {
          await this.stockService.liberarStock(p.nombre, p.cantidad);
        }
        await this.eliminarComprobanteSiExiste(pedido);
        try {
          await this.notificarCancelacionCliente(
            pedido,
            'Pago rechazado o cancelado',
          );
        } catch (e) {
          console.error('mail cancelacion cliente', e);
        }
        break;

      default:
        console.log(
          `ℹ Estado ${estado} no requiere acción, manteniendo PENDIENTE`,
        );
        break;
    }

    await this.pedidoRepo.save(pedido);

    if (pedido.estado === 'APROBADO') {
      await this.registrarUsoCuponSiCorresponde(pedido);
    }

    return {
      message: `Pedido ${pedido.external_id} procesado correctamente`,
      estado: pedido.estado,
    };
  }

  async encontrarPorExternalId(externalId: string): Promise<Pedido | null> {
    return this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });
  }

  async listarParaDashboard(query: GetPedidosDashboardDto): Promise<{
    items: Pedido[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const offset = (page - 1) * limit;

    const qb = this.pedidoRepo.createQueryBuilder('pedido');

    if (query.estado) {
      if (!['PENDIENTE', 'APROBADO', 'CANCELADO'].includes(query.estado)) {
        throw new BadRequestException('Estado inválido');
      }
      qb.andWhere('pedido.estado = :estado', { estado: query.estado });
    }

    if (query.metodo_pago) {
      if (!['online', 'transfer'].includes(query.metodo_pago)) {
        throw new BadRequestException('Método de pago inválido');
      }
      qb.andWhere('pedido.metodo_pago = :metodoPago', {
        metodoPago: query.metodo_pago,
      });
    }

    if (query.delivery_method) {
      if (!['pickup', 'shipping'].includes(query.delivery_method)) {
        throw new BadRequestException('Tipo de envío inválido');
      }
      qb.andWhere('pedido.delivery_method = :deliveryMethod', {
        deliveryMethod: query.delivery_method,
      });
    }

    const fromDate = this.parseDateStart(query.from);
    const toDate = this.parseDateEnd(query.to);

    if (fromDate) {
      qb.andWhere('pedido.creado >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('pedido.creado <= :toDate', { toDate });
    }

    const search = query.q?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('pedido.cliente_nombre LIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('pedido.cliente_cuit LIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('pedido.external_id LIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    qb.orderBy('pedido.creado', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async cancelarPedidoPendiente(externalId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${externalId} no encontrado`);
    }

    if (pedido.estado !== 'PENDIENTE') {
      throw new ConflictException(
        `Pedido ${externalId} no puede cancelarse (estado: ${pedido.estado})`,
      );
    }

    for (const producto of pedido.productos) {
      try {
        await this.stockService.liberarStock(
          producto.nombre,
          producto.cantidad,
        );
      } catch (err) {
        console.error(`❌ Error liberando stock de ${producto.nombre}:`, err);
      }
    }

    pedido.estado = 'CANCELADO';
    await this.eliminarComprobanteSiExiste(pedido);
    const pedidoCancelado = await this.pedidoRepo.save(pedido);

    try {
      await this.notificarCancelacionCliente(
        pedidoCancelado,
        'Pedido cancelado por administracion',
      );
    } catch (e) {
      console.error('mail cancelacion cliente', e);
    }

    return pedidoCancelado;
  }

  // 💳 Aprobar pedido por transferencia
  async aprobarTransferencia(
    externalId: string,
  ): Promise<{ pedido: Pedido; comprobante: any }> {
    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
      relations: ['productos'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${externalId} no encontrado`);
    }

    if (pedido.metodo_pago !== 'transfer') {
      throw new BadRequestException(
        `Pedido ${externalId} no es de tipo transferencia`,
      );
    }

    if (pedido.estado !== 'PENDIENTE') {
      throw new ConflictException(
        `Pedido ${externalId} ya fue procesado (estado: ${pedido.estado})`,
      );
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
    let comprobanteCreado: { tipo: string; comprobante: string };
    if (pedido.comprobante_tipo && pedido.comprobante_numero) {
      comprobanteCreado = {
        tipo: pedido.comprobante_tipo,
        comprobante: pedido.comprobante_numero,
      };
    } else {
      try {
        const comp = await this.vtaComprobanteService.crearDesdePedido(pedido);
        comprobanteCreado = { tipo: comp.tipo, comprobante: comp.comprobante };
        pedido.comprobante_tipo = comp.tipo;
        pedido.comprobante_numero = comp.comprobante;
        console.log(
          `🧾 Comprobante generado para pedido transferencia ${pedido.external_id}:`,
          comprobanteCreado,
        );
      } catch (err) {
        console.error(
          `❌ Error al generar comprobante para pedido ${pedido.external_id}:`,
          err,
        );
        throw err;
      }
    }

    // NO generar cobro para transferencias

    // Guardar pedido actualizado
    await this.pedidoRepo.save(pedido);
    await this.registrarUsoCuponSiCorresponde(pedido);

    // Notificaciones no críticas
    try {
      await this.notificarSecretaria(pedido);
    } catch (e) {
      console.error('mail', e);
    }
    // WhatsApp desactivado temporalmente. Reactivar si se quiere volver a notificar por este canal.
    // try {
    //   const msg = this.whatsappService.formatearMensajePedido(pedido);
    //   await this.whatsappService.enviarMensaje(msg);
    // } catch (e) { console.error('whatsapp', e); }

    try {
      const msg = this.whatsappService.formatearMensajePedido(pedido);
      await this.telegramService.enviarMensaje(msg);
    } catch (e) {
      console.error('telegram', e);
    }

    if (pedido.delivery_method === 'shipping') {
      // WhatsApp delivery desactivado temporalmente. Reactivar si se quiere volver a notificar por este canal.
      // try {
      //   const msg = this.whatsappService.formatearMensajeParaDelivery(pedido);
      //   const phone = this.configService.get<string>('DELIVERY_WHATSAPP_PHONE');
      //   const apiKey = this.configService.get<string>('DELIVERY_WHATSAPP_API_KEY');
      //   if (phone && apiKey) await this.whatsappService.enviarMensaje(msg, phone, apiKey);
      // } catch (e) { console.error('delivery whatsapp', e); }

      try {
        const msg = this.whatsappService.formatearMensajeParaDelivery(pedido);
        await this.telegramService.enviarMensajeDelivery(msg);
      } catch (e) {
        console.error('delivery telegram', e);
      }
    }

    return { pedido, comprobante: comprobanteCreado };
  }

  // ❌ Rechazar pedido por transferencia
  async rechazarTransferencia(externalId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepo.findOne({
      where: { external_id: externalId },
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${externalId} no encontrado`);
    }

    if (pedido.metodo_pago !== 'transfer') {
      throw new BadRequestException(
        `Pedido ${externalId} no es de tipo transferencia`,
      );
    }

    const cancelado = await this.cancelarPedidoPendiente(externalId);

    console.log(`✅ Pedido transferencia ${externalId} rechazado manualmente`);

    return cancelado;
  }

  private async eliminarComprobanteSiExiste(pedido: Pedido): Promise<void> {
    if (!pedido.comprobante_tipo || !pedido.comprobante_numero) {
      return;
    }

    const tipo = pedido.comprobante_tipo;
    const comprobante = pedido.comprobante_numero;

    await this.vtaComprobanteService.eliminarComprobantePorPedido(
      tipo,
      comprobante,
    );

    pedido.comprobante_tipo = null;
    pedido.comprobante_numero = null;
  }

  private async registrarUsoCuponSiCorresponde(pedido: Pedido): Promise<void> {
    if (!pedido.codigo_cupon) {
      return;
    }

    try {
      await this.cuponService.usarCupon({
        cupon_id: pedido.codigo_cupon,
        cuit: pedido.cliente_cuit,
        pedido_id: pedido.id,
      });
    } catch (e) {
      console.error(
        `Error registrando uso de cupon para pedido ${pedido.external_id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  private normalizePage(page?: number | string): number {
    const value = Number(page ?? 1);
    if (!Number.isFinite(value) || value < 1) {
      return 1;
    }
    return Math.floor(value);
  }

  private normalizeLimit(limit?: number | string): number {
    const value = Number(limit ?? 20);
    if (!Number.isFinite(value) || value < 1) {
      return 20;
    }
    return Math.min(Math.floor(value), 100);
  }

  private parseDateStart(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseDateEnd(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(`${value}T23:59:59.999`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private redondear2(valor: number): number {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }

  private redondearPrecio(valor: number): number {
    if (!Number.isFinite(valor)) {
      throw new BadRequestException('Importe monetario invalido');
    }

    return Number(Math.round(valor).toFixed(2));
  }

  private calcularIvaFacturaImporte(importe: number): number {
    return this.redondearPrecio(importe * (FACTURA_IVA_PORCENTAJE / 100));
  }

  private normalizarFacturaTipo(
    facturaTipo?: CreatePedidoDto['factura_tipo'],
  ): 'A' | 'B' | null {
    return facturaTipo === 'A' || facturaTipo === 'B' ? facturaTipo : null;
  }

  private calcularCostoEnvioPedido(
    dto: CreatePedidoDto,
    pesoTotalKg: number,
  ): number {
    if (
      dto.tipo_envio === 'shipping' &&
      pesoTotalKg >= FREE_SHIPPING_MIN_WEIGHT_KG
    ) {
      return 0;
    }

    return this.redondearPrecio(Number(dto.costo_envio ?? 0));
  }

  private esProductoEnvio(nombre?: string | null): boolean {
    return /^ENV-\d+K-GM-DELIVERY$/i.test(String(nombre ?? ''));
  }

  private obtenerCostoEnvioDesdeProductos(productos: PedidoItem[]): number | null {
    const totalEnvio = productos
      .filter((producto) => this.esProductoEnvio(producto.nombre))
      .reduce((acc, producto) => acc + Number(producto.subtotal ?? 0), 0);

    return totalEnvio > 0 ? this.redondearPrecio(totalEnvio) : null;
  }

  private calcularProductoPedido(
    producto: CreatePedidoDto['productos'][number],
    item: StkItem,
    porcentajeCupon: number,
    metodoPago: PedidoMetodoPago,
    peso?: number,
    cantidadParaDescuento?: number,
    esProductoEnvio = false,
    incluyeIvaFactura = false,
  ): PedidoProductoCalculado {
    const cantidad = this.obtenerCantidadProducto(producto);
    const precioBaseUnitario = this.obtenerPrecioListaCotizado(
      item,
      incluyeIvaFactura ? 'MINORISTA CON IVA' : 'MINORISTA',
    );
    const productoDescuento = {
      id: item.id,
      category: item.grupo,
    };
    const pesoProducto = peso ?? parseProductWeightFromDescription(item.descripcion);
    const cantidadDescuentoProducto = cantidadParaDescuento ?? cantidad;
    const aplicaDescuentoProducto =
      !esProductoEnvio &&
      (metodoPago === 'transfer' ||
        (isEligibleForQuantityDiscount(productoDescuento, pesoProducto ?? 0) &&
          cantidadDescuentoProducto >= ONLINE_QUANTITY_DISCOUNT_MIN_QUANTITY));
    const porcentajeCuponAplicable = esProductoEnvio ? 0 : porcentajeCupon;
    const descuentoProductoPorcentaje = aplicaDescuentoProducto
      ? this.parsearPorcentajeDescuento(
          getDiscountPercentageForProduct(
            productoDescuento,
            cantidadDescuentoProducto,
            pesoProducto,
          ),
        )
      : 0;
    const descuentoPorcentaje = Math.max(
      descuentoProductoPorcentaje,
      porcentajeCuponAplicable,
    );
    const subtotal = this.redondearPrecio(
      precioBaseUnitario * cantidad * (1 - descuentoPorcentaje / 100),
    );
    const precioUnitario = this.redondearPrecio(subtotal / cantidad);
    const descuentoCuponAplicado =
      porcentajeCuponAplicable > descuentoProductoPorcentaje
        ? this.redondearPrecio(
            precioBaseUnitario * cantidad - subtotal,
          )
        : 0;

    return {
      nombre: producto.nombre,
      cantidad,
      precio_base_unitario: precioBaseUnitario,
      precio_unitario: precioUnitario,
      subtotal,
      ajuste_porcentaje: descuentoPorcentaje > 0 ? descuentoPorcentaje : null,
      descuento_cupon_aplicado: descuentoCuponAplicado,
    };
  }

  private obtenerCantidadProducto(
    producto: CreatePedidoDto['productos'][number],
  ): number {
    const cantidad = Number(producto.cantidad ?? 0);

    if (!Number.isFinite(cantidad) || cantidad < 1) {
      throw new BadRequestException(
        `Producto '${producto.nombre}': cantidad debe ser un valor valido.`,
      );
    }

    return cantidad;
  }

  private parsearPorcentajeDescuento(porcentaje: string): number {
    const valor = Number(porcentaje.replace('%', ''));
    return Number.isFinite(valor) ? valor : 0;
  }

  private obtenerPrecioListaCotizado(
    item: StkItem,
    lista: 'MINORISTA' | 'MINORISTA CON IVA',
  ): number {
    const precioLista = item.stkPrecios?.find(
      (precio) => precio.lista === lista,
    );

    if (!precioLista) {
      throw new NotFoundException(
        `Precio ${lista} no disponible para ${item.id}`,
      );
    }

    const precioVta = Number(precioLista.precioVta ?? 0);
    const isDolar = precioLista.moneda?.id === 'DOL';
    const cotizacion = isDolar ? Number(precioLista.moneda?.cotizacion) : 1;

    if (
      !Number.isFinite(precioVta) ||
      precioVta <= 0 ||
      !Number.isFinite(cotizacion) ||
      cotizacion <= 0
    ) {
      throw new BadRequestException(
        `Precio ${lista} invalido para ${item.id}`,
      );
    }

    return this.redondearPrecio(precioVta * cotizacion);
  }

  private pedidoItemDesdeCalculo(
    producto: PedidoProductoCalculado,
    descripcion: string | null,
  ): PedidoItem {
    return {
      nombre: producto.nombre,
      descripcion,
      cantidad: producto.cantidad,
      precio_unitario: producto.precio_unitario,
      subtotal: producto.subtotal,
      ajuste_porcentaje: producto.ajuste_porcentaje,
    } as PedidoItem;
  }

  private obtenerDiferenciaProducto(
    producto: CreatePedidoDto['productos'][number],
    calculado: PedidoProductoCalculado,
    incluyeIvaFactura = false,
  ): PedidoProductoMismatch | null {
    const precioFueEnviado = producto.precio_unitario !== undefined;
    const subtotalFueEnviado = producto.subtotal !== undefined;
    const precioRecibido = precioFueEnviado
      ? Number(producto.precio_unitario)
      : undefined;
    const subtotalRecibido = subtotalFueEnviado
      ? Number(producto.subtotal)
      : undefined;
    const subtotalBruto = this.redondearPrecio(
      calculado.precio_base_unitario * calculado.cantidad,
    );
    const ivaSubtotal = incluyeIvaFactura
      ? this.calcularIvaFacturaImporte(calculado.subtotal)
      : 0;
    const subtotalEsperado = calculado.subtotal + ivaSubtotal;
    const precioUnitarioEsperado = incluyeIvaFactura
      ? this.redondearPrecio(subtotalEsperado / calculado.cantidad)
      : calculado.precio_unitario;
    const subtotalBrutoEsperado = incluyeIvaFactura
      ? subtotalBruto + this.calcularIvaFacturaImporte(subtotalBruto)
      : subtotalBruto;

    const difierePrecio =
      precioFueEnviado &&
      !this.montosIguales(precioRecibido, precioUnitarioEsperado);
    const difiereSubtotal =
      subtotalFueEnviado &&
      !this.montosIguales(subtotalRecibido, subtotalEsperado) &&
      !this.montosIguales(subtotalRecibido, subtotalBrutoEsperado);

    if (!difierePrecio && !difiereSubtotal) {
      return null;
    }

    const expected: PedidoProductoMismatch['expected'] = {};
    const received: PedidoProductoMismatch['received'] = {};

    if (difierePrecio) {
      expected.precio_unitario = precioUnitarioEsperado;
      received.precio_unitario = precioRecibido;
    }

    if (difiereSubtotal) {
      expected.subtotal = subtotalEsperado;
      received.subtotal = subtotalRecibido;
    }

    return {
      nombre: producto.nombre,
      expected,
      received,
    };
  }

  private async resolverPorcentajeCupon(
    codigoCupon: string | undefined,
    metodoPago: PedidoMetodoPago,
  ): Promise<number> {
    if (!codigoCupon) {
      return 0;
    }

    const descuento = await this.cuponService.resolverPorcentajePorModalidad(
      codigoCupon,
      metodoPago === 'transfer' ? 'CUENTA' : 'TARJETA',
    );

    const porcentaje = Number(descuento.porcentajeAplicado ?? 0);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      throw new BadRequestException(
        `Porcentaje de descuento invalido para el cupon ${codigoCupon}`,
      );
    }

    return porcentaje;
  }

  private async validarTotalesRecibidos(
    dto: CreatePedidoDto,
    calculado: {
      total: number;
      descuento_cupon: number;
      productos: PedidoProductoMismatch[];
      costo_envio: number;
      subtotal_sin_iva?: number;
      factura_iva_importe?: number | null;
    },
  ): Promise<void> {
    const diferencias: {
      expected: {
        total?: number;
        descuento_cupon?: number;
      };
      received: {
        total?: number;
        descuento_cupon?: number;
      };
      productos: PedidoProductoMismatch[];
    } = {
      expected: {},
      received: {},
      productos: calculado.productos,
    };

    if (
      dto.total !== undefined &&
      !this.montosIguales(Number(dto.total), calculado.total)
    ) {
      diferencias.expected.total = calculado.total;
      diferencias.received.total = Number(dto.total);
    }

    if (
      dto.descuento_cupon !== undefined &&
      !this.montosIguales(Number(dto.descuento_cupon), calculado.descuento_cupon)
    ) {
      diferencias.expected.descuento_cupon = calculado.descuento_cupon;
      diferencias.received.descuento_cupon = Number(dto.descuento_cupon);
    }

    const tieneDiferencias =
      Object.keys(diferencias.expected).length > 0 ||
      diferencias.productos.length > 0;

    if (!tieneDiferencias) {
      return;
    }

    const logImportes = {
      code: 'ERR_ORDER_TOTAL_MISMATCH',
      cliente_nombre: dto.cliente_nombre,
      cliente_cuit: dto.cliente_cuit,
      cliente_mail: dto.email ?? dto.cliente_mail,
      telefono: dto.telefono ?? dto.mobile,
      metodo_pago: dto.metodo_pago ?? 'online',
      factura_tipo: dto.factura_tipo,
      factura_tipo_normalizado: this.normalizarFacturaTipo(dto.factura_tipo),
      codigo_cupon: dto.codigo_cupon,
      costo_envio: calculado.costo_envio,
      subtotal_sin_iva: calculado.subtotal_sin_iva,
      factura_iva_importe: calculado.factura_iva_importe,
      total_calculado: calculado.total,
      expected: diferencias.expected,
      received: diferencias.received,
      productos: diferencias.productos,
      productos_recibidos: dto.productos.map((producto) => ({
        nombre: producto.nombre,
        cantidad: producto.cantidad,
        precio_unitario: producto.precio_unitario,
        subtotal: producto.subtotal,
        ajuste_porcentaje: producto.ajuste_porcentaje,
      })),
    };

    this.logger.warn(
      logImportes,
      'Los importes recibidos no coinciden con el calculo del servidor.',
    );
    await this.enviarAlertaImportesNoCoinciden(logImportes);

    throw new BadRequestException({
      code: 'ERR_ORDER_TOTAL_MISMATCH',
      message: 'Los importes recibidos no coinciden con el calculo del servidor.',
      expected: diferencias.expected,
      received: diferencias.received,
      productos: diferencias.productos,
    });
  }

  private async enviarAlertaImportesNoCoinciden(
    logImportes: Record<string, unknown>,
  ): Promise<void> {
    const logJson = JSON.stringify(logImportes, null, 2);
    const html = `
      <h2>Alerta: importes no coinciden</h2>
      <p>Se rechazo un pedido porque los importes recibidos no coinciden con el calculo del servidor.</p>
      <pre style="white-space: pre-wrap; font-family: monospace; background: #f5f5f5; padding: 12px; border: 1px solid #ddd;">${this.escapeHtml(logJson)}</pre>
    `;

    try {
      await this.mailerService.enviarCorreo(
        ALERTA_IMPORTES_EMAIL,
        'Alerta WeTech: importes no coinciden',
        html,
      );
    } catch (error) {
      this.logger.error(
        'No se pudo enviar alerta de importes no coincidentes',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private montosIguales(
    recibido: number | undefined,
    esperado: number,
  ): boolean {
    if (!Number.isFinite(recibido) || !Number.isFinite(esperado)) {
      return false;
    }

    return Math.abs(Number(recibido) - esperado) <= 0.01;
  }

  private validarSubtotalProducto(
    producto: CreatePedidoDto['productos'][number],
  ): void {
    const cantidad = Number(producto.cantidad ?? 0);
    const precioUnitarioNeto = Number(producto.precio_unitario ?? 0);
    const subtotalBruto = this.redondear2(Number(producto.subtotal ?? 0));
    const ajustePorcentaje = Number(producto.ajuste_porcentaje ?? 0);

    if (
      !Number.isFinite(cantidad) ||
      !Number.isFinite(precioUnitarioNeto) ||
      !Number.isFinite(subtotalBruto)
    ) {
      throw new BadRequestException(
        `Producto '${producto.nombre}': cantidad, precio_unitario y subtotal deben ser valores numéricos válidos.`,
      );
    }

    const factorDescuento = 1 - Math.abs(ajustePorcentaje) / 100;
    if (factorDescuento <= 0) {
      throw new BadRequestException(
        `Producto '${producto.nombre}': ajuste_porcentaje debe ser menor a 100.`,
      );
    }

    const netoCalculado = this.redondear2(cantidad * precioUnitarioNeto);
    const netoEsperadoDesdeSubtotal = this.redondear2(
      subtotalBruto * factorDescuento,
    );
    const precisionPrecio = this.obtenerPrecisionDecimal(precioUnitarioNeto);
    const brutoUnitario = cantidad > 0 ? subtotalBruto / cantidad : 0;
    const netoUnitarioEsperado = this.redondearConPrecision(
      brutoUnitario * factorDescuento,
      precisionPrecio,
    );
    const netoEsperadoPorUnidad = this.redondear2(
      netoUnitarioEsperado * cantidad,
    );

    const tolerancia = 0.01;
    const coincideCalculoLinea =
      Math.abs(netoCalculado - netoEsperadoDesdeSubtotal) <= tolerancia;
    const coincideCalculoUnitario =
      Math.abs(netoCalculado - netoEsperadoPorUnidad) <= tolerancia;

    if (!coincideCalculoLinea && !coincideCalculoUnitario) {
      throw new BadRequestException(
        `Producto '${producto.nombre}': subtotal inconsistente con cantidad/precio_unitario/ajuste_porcentaje.`,
      );
    }
  }

  private obtenerPrecisionDecimal(valor: number): number {
    if (!Number.isFinite(valor)) {
      return 2;
    }

    const texto = valor.toString();
    const decimales = texto.includes('.') ? texto.split('.')[1].length : 0;
    return Math.min(decimales, 2);
  }

  private redondearConPrecision(valor: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round((valor + Number.EPSILON) * factor) / factor;
  }

  private buildProductosHtml(pedido: Pedido): string {
    return pedido.productos
      .map(
        (p) => `
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="vertical-align: top;">
            <td style="padding: 16px 8px 0 0; width: 100%;">
              <div>${p.nombre}</div>
              <div style="font-size: 14px; color: #888; padding-top: 4px;">Cantidad: ${p.cantidad}</div>
              <div style="font-size: 14px; color: #888; padding-top: 2px;">Unitario neto: $${Number(p.precio_unitario).toFixed(2)}</div>
            </td>
            <td style="padding: 16px 4px 0 0; white-space: nowrap; text-align: right;">
              <strong>$${Number(p.subtotal).toFixed(2)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    `,
      )
      .join('');
  }

  private async notificarTransferenciaPendiente(pedido: Pedido) {
    const secretariaEmail = this.configService.get<string>('SECRETARIA_EMAIL');
    const clienteEmail = pedido.cliente_mail;
    const productosHtml = this.buildProductosHtml(pedido);
    const callbackUrl = `https://shop.wetech.ar/checkout/callback?payment_id=${pedido.external_id}`;

    const datosTransferencia = `
      <div style="margin: 12px 0; padding: 12px; background-color: #f5f5f5; border-radius: 6px;">
        <div style="font-weight: 600; margin-bottom: 6px;">Te envio los datos de mi cuenta ICBC:</div>
        <div>Nombre: HELLO SRL</div>
        <div>CBU: 0150516002000111877146</div>
        <div>Alias: WEICBC</div>
      </div>
    `;

    const htmlCliente = `
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #333; padding: 14px 8px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: auto; background-color: #fff;">
    <div style="border-top: 6px solid #458500; padding: 16px;">
      <a style="text-decoration: none; outline: none; margin-right: 8px; vertical-align: middle;" href="https://shop.wetech.ar" target="_blank" rel="noopener">
        <img src="https://shop.wetech.ar/assets/Logo%20WeTECH%20Negro%20PNG-CPBuO7yQ.png" width="103" height="41" alt="WeTECH Logo">
      </a>
      <span style="font-size: 16px; vertical-align: middle; border-left: 1px solid #333; padding-left: 8px;">
        <strong>Pedido recibido - Transferencia pendiente</strong>
      </span>
    </div>

    <div style="padding: 0 16px;">
      <p>Estimado/a <strong>${pedido.cliente_nombre}</strong>,<br>
      recibimos tu pedido y quedo pendiente de transferencia. Para completar el pago, realiza la transferencia a:</p>

      ${datosTransferencia}

      <div style="margin: 12px 0; font-size: 14px; color: #555;">
        <div><strong>Pedido:</strong> ${pedido.external_id}</div>
        <div><strong>Estado del pedido:</strong> <a href="${callbackUrl}" target="_blank" rel="noopener">Ver estado</a></div>
        <div><strong>CUIT:</strong> ${pedido.cliente_cuit}</div>
        <div><strong>Tipo de envio:</strong> ${pedido.delivery_method || 'pickup'}</div>
        <div><strong>Costo de envio:</strong> $${pedido.costo_envio != null ? Number(pedido.costo_envio).toFixed(2) : '0.00'}</div>
      </div>

      <div style="text-align: left; font-size: 14px; padding-bottom: 4px; border-bottom: 2px solid #333;">
        <strong>Detalles del Pedido</strong>
      </div>

      ${productosHtml}

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

  <div style="max-width: 600px; margin: auto; padding: 12px; text-align: center;">
    <p style="color: #999; font-size: 12px;">
      Este correo fue enviado a ${pedido.cliente_mail}<br>
      Usted recibio este correo porque realizo un pedido en WeTECH
    </p>
  </div>
</div>
    `;

    if (clienteEmail) {
      await this.mailerService.enviarCorreo(
        clienteEmail,
        'Pedido recibido - Transferencia pendiente',
        htmlCliente,
      );
    } else {
      console.warn(
        `No se encontro email de cliente para pedido ${pedido.external_id}`,
      );
    }

    if (!secretariaEmail) {
      console.warn('Falta el email de secretaria');
      return;
    }

    const htmlSecretaria = `
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #333; padding: 14px 8px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: auto; background-color: #fff;">
    <div style="border-top: 6px solid #458500; padding: 16px;">
      <a style="text-decoration: none; outline: none; margin-right: 8px; vertical-align: middle;" href="https://shop.wetech.ar" target="_blank" rel="noopener">
        <img src="https://shop.wetech.ar/assets/Logo%20WeTECH%20Negro%20PNG-CPBuO7yQ.png" width="103" height="41" alt="WeTECH Logo">
      </a>
      <span style="font-size: 16px; vertical-align: middle; border-left: 1px solid #333; padding-left: 8px;">
        <strong>Pedido recibido - Transferencia pendiente</strong>
      </span>
    </div>

    <div style="padding: 0 16px;">
      <p>Se recibio un pedido con metodo de pago por transferencia pendiente.</p>

      <div style="margin: 12px 0; font-size: 14px; color: #555;">
        <div><strong>Cliente:</strong> ${pedido.cliente_nombre}</div>
        <div><strong>Email:</strong> ${pedido.cliente_mail || 'No informado'}</div>
        <div><strong>CUIT:</strong> ${pedido.cliente_cuit}</div>
        <div><strong>Ubicacion:</strong> ${pedido.cliente_ubicacion || 'No especificada'}</div>
        <div><strong>Observaciones:</strong> ${pedido.observaciones_direccion || 'Ninguna'}</div>
        <div><strong>Pedido:</strong> ${pedido.external_id}</div>
        <div><strong>Estado del pedido:</strong> <a href="${callbackUrl}" target="_blank" rel="noopener">Ver estado</a></div>
        <div><strong>Tipo de envio:</strong> ${pedido.delivery_method || 'pickup'}</div>
        <div><strong>Costo de envio:</strong> $${pedido.costo_envio != null ? Number(pedido.costo_envio).toFixed(2) : '0.00'}</div>
      </div>

      <div style="text-align: left; font-size: 14px; padding-bottom: 4px; border-bottom: 2px solid #333;">
        <strong>Detalles del Pedido</strong>
      </div>

      ${productosHtml}

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
</div>
    `;

    await this.mailerService.enviarCorreo(
      secretariaEmail,
      'Pedido recibido - Transferencia pendiente',
      htmlSecretaria,
    );
  }

  private async notificarSecretaria(pedido: Pedido) {
    const secretariaEmail = this.configService.get<string>('SECRETARIA_EMAIL');
    const destinatarios = `${secretariaEmail}, ${pedido.cliente_mail}`;

    if (!secretariaEmail) {
      throw new InternalServerErrorException('Falta el email de secretaria');
    }

    // Lista de productos en HTML
    const productosHtml = this.buildProductosHtml(pedido);

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

  private async notificarCancelacionCliente(pedido: Pedido, motivo: string) {
    const clienteEmail = pedido.cliente_mail;
    if (!clienteEmail) {
      console.warn(
        `No se encontro email de cliente para pedido cancelado ${pedido.external_id}`,
      );
      return;
    }

    const productosHtml = this.buildProductosHtml(pedido);

    const htmlCliente = `
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; color: #333; padding: 14px 8px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: auto; background-color: #fff;">
    <div style="border-top: 6px solid #cc0000; padding: 16px;">
      <a style="text-decoration: none; outline: none; margin-right: 8px; vertical-align: middle;" href="https://shop.wetech.ar" target="_blank" rel="noopener">
        <img src="https://shop.wetech.ar/assets/Logo%20WeTECH%20Negro%20PNG-CPBuO7yQ.png" width="103" height="41" alt="WeTECH Logo">
      </a>
      <span style="font-size: 16px; vertical-align: middle; border-left: 1px solid #333; padding-left: 8px;">
        <strong>Pedido cancelado</strong>
      </span>
    </div>

    <div style="padding: 0 16px;">
      <p>Estimado/a <strong>${pedido.cliente_nombre}</strong>,<br>
      te informamos que tu pedido fue cancelado.</p>

      <div style="margin: 12px 0; font-size: 14px; color: #555;">
        <div><strong>Pedido:</strong> ${pedido.external_id}</div>
        <div><strong>Motivo:</strong> ${motivo}</div>
        <div><strong>Estado:</strong> ${pedido.estado}</div>
      </div>

      <div style="text-align: left; font-size: 14px; padding-bottom: 4px; border-bottom: 2px solid #333;">
        <strong>Detalles del Pedido</strong>
      </div>

      ${productosHtml}

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

  <div style="max-width: 600px; margin: auto; padding: 12px; text-align: center;">
    <p style="color: #999; font-size: 12px;">
      Este correo fue enviado a ${pedido.cliente_mail}<br>
      Si tenes dudas, comunicate con nuestro equipo.
    </p>
  </div>
</div>
    `;

    await this.mailerService.enviarCorreo(
      clienteEmail,
      'Pedido cancelado - WeTECH',
      htmlCliente,
    );
  }
}
