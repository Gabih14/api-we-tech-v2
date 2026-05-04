import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  constructor(private configService: ConfigService) {}

  async enviarMensaje(mensaje: string, phone?: string, apiKey?: string): Promise<void> {
    const phoneToUse = phone || this.configService.get<string>('WHATSAPP_PHONE');
    const apiKeyToUse = apiKey || this.configService.get<string>('WHATSAPP_API_KEY');

    if (!phoneToUse || !apiKeyToUse) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para WhatsApp (phone y apiKey)',
      );
    }

    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneToUse}&text=${mensajeCodificado}&apikey=${apiKeyToUse}`;

    try {
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      console.log(`✅ Mensaje de WhatsApp enviado a ${phoneToUse}`);
    } catch (err) {
      console.error('❌ Error al enviar WhatsApp:', err);
      throw new InternalServerErrorException(
        `Error al enviar mensaje de WhatsApp: ${err.message}`,
      );
    }
  }

  formatearMensajePedido(pedido: any): string {
    const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - Neto u. $${Number(p.precio_unitario).toFixed(2)}`)
      .join('\n');

    const ubicacion = pedido.cliente_ubicacion || 'No especificada';
    const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : '$0.00';
    const tipoEnvio = pedido.delivery_method || 'pickup';
    const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';
    const comprobante = this.formatearComprobante(pedido);

    return `🛒 *Nuevo Pedido Aprobado*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n🆔 *CUIT:* ${pedido.cliente_cuit}\n📧 *Email:* ${pedido.cliente_mail}\n\n📍 *Ubicación:* ${ubicacion}${observaciones}\n🚚 *Tipo envío:* ${tipoEnvio}\n💰 *Costo envío:* ${costoEnvio}\n\n*Productos:*\n${productos}\n\n💰 *Total:* $${pedido.total.toFixed(2)}${comprobante}\n\nID: ${pedido.external_id}`;
  }

  formatearMensajeTransferenciaPendiente(pedido: any): string {
    const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - Neto u. $${Number(p.precio_unitario).toFixed(2)}`)
      .join('\n');

    const ubicacion = pedido.cliente_ubicacion || 'No especificada';
    const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : '$0.00';
    const tipoEnvio = pedido.delivery_method || 'pickup';
    const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';
    const callbackUrl = `https://shop.wetech.ar/checkout/callback?payment_id=${pedido.external_id}`;
    const comprobante = this.formatearComprobante(pedido);

    return `⏳ *Pedido Transferencia Pendiente*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n🆔 *CUIT:* ${pedido.cliente_cuit}\n📧 *Email:* ${pedido.cliente_mail}\n\n📍 *Ubicación:* ${ubicacion}${observaciones}\n🚚 *Tipo envío:* ${tipoEnvio}\n💰 *Costo envío:* ${costoEnvio}\n\n*Productos:*\n${productos}\n\n💰 *Total:* $${pedido.total.toFixed(2)}${comprobante}\n\n🔗 Estado: ${callbackUrl}\n\nID: ${pedido.external_id}`;
  }

  formatearMensajeParaDelivery(pedido: any): string {
    const productos = Array.isArray(pedido.productos) && pedido.productos.length > 0
      ? `\n\n*Productos:*\n${pedido.productos
          .map((p) => `- ${p.nombre} x${p.cantidad} - Neto u. $${Number(p.precio_unitario).toFixed(2)}`)
          .join('\n')}`
      : '';
    const ubicacionLimpia = pedido.cliente_ubicacion?.trim();
    const ubicacion = ubicacionLimpia || 'Sin ubicación proporcionada';
    const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : 'No especificado';
    const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';
    const comprobante = this.formatearComprobante(pedido);
    const mapsLink = this.formatearLinkMaps(ubicacionLimpia);

    return `🚚 *Nuevo Pedido para Delivery*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n📍 *Ubicación:* ${ubicacion}${observaciones}${mapsLink}\n💰 *Costo envío:* ${costoEnvio}${productos}${comprobante}\n\nID: ${pedido.external_id}`;
  }

  private formatearLinkMaps(ubicacion?: string | null): string {
    const ubicacionLimpia = ubicacion?.trim();

    if (!ubicacionLimpia) {
      return '';
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacionLimpia)}`;
    return `\n🗺️ *Maps:* ${url}`;
  }

  private formatearComprobante(pedido: any): string {
    if (!pedido.comprobante_numero) {
      return '';
    }

    const tipo = pedido.comprobante_tipo ? `${pedido.comprobante_tipo} ` : '';
    return `\n🧾 *Comprobante:* ${tipo}${pedido.comprobante_numero}`;
  }
}
