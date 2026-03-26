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

    // Codificar el mensaje para URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phoneToUse}&text=${mensajeCodificado}&apikey=${apiKeyToUse}`;

    try {
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      console.log(`✅ Mensaje de WhatsApp enviado a ${phoneToUse}`);
    } catch (err) {
      console.error(`❌ Error al enviar WhatsApp:`, err);
      throw new InternalServerErrorException(
        `Error al enviar mensaje de WhatsApp: ${err.message}`,
      );
    }
  }

  formatearMensajePedido(pedido: any): string {
    const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - Bruto $${Number(p.subtotal ?? (p.cantidad * p.precio_unitario)).toFixed(2)} (Neto u. $${Number(p.precio_unitario).toFixed(2)})`)
      .join('\n');





      const ubicacion = pedido.cliente_ubicacion || 'No especificada';
      const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : '$0.00';
      const tipoEnvio = pedido.delivery_method || 'pickup';
      const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';


      return `🛒 *Nuevo Pedido Aprobado*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n🆔 *CUIT:* ${pedido.cliente_cuit}\n📧 *Email:* ${pedido.cliente_mail}\n\n📍 *Ubicación:* ${ubicacion}${observaciones}\n🚚 *Tipo envío:* ${tipoEnvio}\n💰 *Costo envío:* ${costoEnvio}\n\n*Productos:*\n${productos}\n\n💰 *Total:* $${pedido.total.toFixed(2)}\n\nID: ${pedido.external_id}`;
  }

  formatearMensajeTransferenciaPendiente(pedido: any): string {
    const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - Bruto $${Number(p.subtotal ?? (p.cantidad * p.precio_unitario)).toFixed(2)} (Neto u. $${Number(p.precio_unitario).toFixed(2)})`)
      .join('\n');

    const ubicacion = pedido.cliente_ubicacion || 'No especificada';
    const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : '$0.00';
    const tipoEnvio = pedido.delivery_method || 'pickup';
    const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';
    const callbackUrl = `https://shop.wetech.ar/checkout/callback?payment_id=${pedido.external_id}`;

    return `⏳ *Pedido Transferencia Pendiente*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n🆔 *CUIT:* ${pedido.cliente_cuit}\n📧 *Email:* ${pedido.cliente_mail}\n\n📍 *Ubicación:* ${ubicacion}${observaciones}\n🚚 *Tipo envío:* ${tipoEnvio}\n💰 *Costo envío:* ${costoEnvio}\n\n*Productos:*\n${productos}\n\n💰 *Total:* $${pedido.total.toFixed(2)}\n\n🔗 Estado: ${callbackUrl}\n\nID: ${pedido.external_id}`;
  }
  
    formatearMensajeParaDelivery(pedido: any): string {
      const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - Bruto $${Number(p.subtotal ?? (p.cantidad * p.precio_unitario)).toFixed(2)} (Neto u. $${Number(p.precio_unitario).toFixed(2)})`)
      .join('\n');
      const ubicacion = pedido.cliente_ubicacion || 'Sin ubicación proporcionada';
      const costoEnvio = (pedido.costo_envio != null) ? `$${Number(pedido.costo_envio).toFixed(2)}` : 'No especificado';
      const observaciones = pedido.observaciones_direccion ? `\n📝 *Observaciones:* ${pedido.observaciones_direccion}` : '';

      return `🚚 *Nuevo Pedido para Delivery*\n\n📋 *Cliente:* ${pedido.cliente_nombre}\n📍 *Ubicación:* ${ubicacion}${observaciones}\n💰 *Costo envío:* ${costoEnvio}\n\nID: ${pedido.external_id}`;
    }
}