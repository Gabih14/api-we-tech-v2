import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  constructor(private configService: ConfigService) {}

  async enviarMensaje(mensaje: string): Promise<void> {
    const phone = this.configService.get<string>('WHATSAPP_PHONE');
    const apiKey = this.configService.get<string>('WHATSAPP_API_KEY');

    if (!phone || !apiKey) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para WhatsApp (WHATSAPP_PHONE, WHATSAPP_API_KEY)',
      );
    }

    // Codificar el mensaje para URL
    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${mensajeCodificado}&apikey=${apiKey}`;

    try {
      const response = await fetch(url, { method: 'POST' });
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      console.log(`✅ Mensaje de WhatsApp enviado a ${phone}`);
    } catch (err) {
      console.error(`❌ Error al enviar WhatsApp:`, err);
      throw new InternalServerErrorException(
        `Error al enviar mensaje de WhatsApp: ${err.message}`,
      );
    }
  }

  formatearMensajePedido(pedido: any): string {
    const productos = pedido.productos
      .map((p) => `• ${p.nombre} x${p.cantidad} - $${p.precio_unitario.toFixed(2)}`)
      .join('\n');

    return `🛒 *Nuevo Pedido Aprobado*

📋 *Cliente:* ${pedido.cliente_nombre}
🆔 *CUIT:* ${pedido.cliente_cuit}
📧 *Email:* ${pedido.cliente_mail}

*Productos:*
${productos}

💰 *Total:* $${pedido.total.toFixed(2)}

ID: ${pedido.external_id}`;
  }
}