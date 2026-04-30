import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  constructor(private readonly configService: ConfigService) {}

  async enviarMensaje(mensaje: string, chatId?: string): Promise<void> {
    const chatIdToUse = chatId || this.configService.get<string>('TELEGRAM_CHAT_ID');
    await this.enviarMensajeAChat(mensaje, chatIdToUse);
  }

  async enviarMensajeDelivery(mensaje: string): Promise<void> {
    const chatIdToUse = this.configService.get<string>('DELIVERY_TELEGRAM_CHAT_ID');
    await this.enviarMensajeAChat(mensaje, chatIdToUse);
  }

  private async enviarMensajeAChat(mensaje: string, chatIdToUse?: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!botToken || !chatIdToUse) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para Telegram (bot token y chat id)',
      );
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const textoNormalizado = this.normalizarMensaje(mensaje);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatIdToUse,
          text: textoNormalizado,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Error HTTP: ${response.status} - ${body}`);
      }

      console.log(`Mensaje de Telegram enviado a ${chatIdToUse}`);
    } catch (err) {
      console.error('Error al enviar Telegram:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Error al enviar mensaje de Telegram: ${errorMessage}`,
      );
    }
  }

  private normalizarMensaje(mensaje: string): string {
    const mensajeSinEmojis = mensaje
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/\s+\n/g, '\n');

    return this.escaparHtml(mensajeSinEmojis)
      .replace(/\*(.*?)\*/g, '<b>$1</b>')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`(.*?)`/g, '$1');
  }

  private escaparHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
