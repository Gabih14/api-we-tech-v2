import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  constructor(private readonly configService: ConfigService) {}

  async enviarMensaje(mensaje: string, chatId?: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatIdToUse = chatId || this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatIdToUse) {
      throw new InternalServerErrorException(
        'Faltan variables de entorno para Telegram (bot token y chat id)',
      );
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatIdToUse,
          text: mensaje,
          parse_mode: 'Markdown',
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
}
