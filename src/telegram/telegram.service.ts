import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';

type TelegramHttpResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

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
    const timeoutMs = this.obtenerEnteroConfig('TELEGRAM_TIMEOUT_MS', 8000);
    const maxAttempts = this.obtenerEnteroConfig('TELEGRAM_RETRY_ATTEMPTS', 3);
    const retryDelayMs = this.obtenerEnteroConfig('TELEGRAM_RETRY_DELAY_MS', 1000);
    const payload = JSON.stringify({
      chat_id: chatIdToUse,
      text: textoNormalizado,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    let ultimoError: unknown;

    for (let intento = 1; intento <= maxAttempts; intento++) {
      try {
        const response = await this.postJsonConTimeout(url, payload, timeoutMs);

        if (!response.ok) {
          const body = await response.text();
          const error = new Error(`Error HTTP: ${response.status} - ${body}`);

          if (!this.esHttpReintentable(response.status) || intento === maxAttempts) {
            throw error;
          }

          ultimoError = error;
        } else {
          console.log(`Mensaje de Telegram enviado a ${chatIdToUse}`);
          return;
        }
      } catch (err) {
        ultimoError = err;

        if (intento === maxAttempts || !this.esErrorReintentable(err)) {
          break;
        }
      }

      console.warn(
        `Telegram intento ${intento}/${maxAttempts} fallido: ${this.formatearError(
          ultimoError,
        )}. Reintentando...`,
      );
      await this.esperar(retryDelayMs * intento);
    }

    console.error('Error al enviar Telegram:', ultimoError);
    throw new InternalServerErrorException(
      `Error al enviar mensaje de Telegram: ${this.formatearError(ultimoError)}`,
    );
  }

  private normalizarMensaje(mensaje: string): string {
    return this.escaparHtml(mensaje)
      .replace(/\*(.*?)\*/g, '<b>$1</b>');
  }

  private escaparHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async postJsonConTimeout(
    url: string,
    body: string,
    timeoutMs: number,
  ): Promise<TelegramHttpResponse> {
    const parsedUrl = new URL(url);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'POST',
          family: 4,
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode ?? 0;

            resolve({
              ok: status >= 200 && status < 300,
              status,
              text: async () => responseBody,
            });
          });
        },
      );

      req.on('timeout', () => {
        const error = new Error(
          `Telegram request timeout after ${timeoutMs}ms`,
        ) as NodeJS.ErrnoException;
        error.code = 'ETIMEDOUT';
        req.destroy(error);
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private obtenerEnteroConfig(key: string, defaultValue: number): number {
    const value = Number(this.configService.get<string>(key));

    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }

  private esHttpReintentable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private esErrorReintentable(err: unknown): boolean {
    if (!(err instanceof Error)) return false;

    const errorName = err.name.toLowerCase();
    const errorCode = this.obtenerCodigoError(err);

    return (
      errorName.includes('abort') ||
      ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(
        errorCode || '',
      ) ||
      err.message === 'fetch failed'
    );
  }

  private obtenerCodigoError(err: Error): string | undefined {
    const errorWithCode = err as Error & { code?: string; cause?: unknown };

    if (errorWithCode.code) return errorWithCode.code;

    const cause = errorWithCode.cause as { code?: string } | undefined;
    return cause?.code;
  }

  private formatearError(err: unknown): string {
    if (!(err instanceof Error)) return String(err);

    const code = this.obtenerCodigoError(err);
    return code ? `${err.message} (${code})` : err.message;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
