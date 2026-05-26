import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let postJsonMock: jest.SpyInstance;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        const values = {
          TELEGRAM_BOT_TOKEN: 'bot-token',
          TELEGRAM_CHAT_ID: 'chat-id',
          DELIVERY_TELEGRAM_CHAT_ID: 'delivery-chat-id',
          TELEGRAM_RETRY_DELAY_MS: '1',
        };

        return values[key];
      }),
    } as unknown as ConfigService;

    service = new TelegramService(configService);
    postJsonMock = jest
      .spyOn(service as any, 'postJsonConTimeout')
      .mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('envia el mensaje como HTML para Telegram preservando emojis y saltos de linea', async () => {
    const mensaje = '\uD83D\uDE9A *Cliente:* Juan\n\n\uD83D\uDCCD *Ubicacion:* Calle 123';

    await service.enviarMensaje(mensaje);

    const body = JSON.parse(postJsonMock.mock.calls[0][1]);

    expect(body.chat_id).toBe('chat-id');
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_web_page_preview).toBe(true);
    expect(body.text).toBe('\uD83D\uDE9A <b>Cliente:</b> Juan\n\n\uD83D\uDCCD <b>Ubicacion:</b> Calle 123');
    expect(body.text).not.toContain('*Cliente:*');
  });

  it('escapa HTML antes de aplicar el formato de Telegram', async () => {
    await service.enviarMensajeDelivery('*Cliente:* <Juan & Asociados>');

    const body = JSON.parse(postJsonMock.mock.calls[0][1]);

    expect(body.chat_id).toBe('delivery-chat-id');
    expect(body.text).toBe('<b>Cliente:</b> &lt;Juan &amp; Asociados&gt;');
  });

  it('reintenta errores temporales de red antes de fallar', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const error = new TypeError('fetch failed') as Error & { cause?: { code: string } };
    error.cause = { code: 'ETIMEDOUT' };

    postJsonMock.mockRejectedValueOnce(error).mockResolvedValueOnce({ ok: true });

    await service.enviarMensaje('Mensaje');

    expect(postJsonMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fetch failed (ETIMEDOUT)'),
    );
  });

  it('no reintenta errores HTTP no recuperables de Telegram', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    postJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('chat not found'),
    });

    await expect(service.enviarMensaje('Mensaje')).rejects.toThrow(
      'Error al enviar mensaje de Telegram: Error HTTP: 400 - chat not found',
    );

    expect(postJsonMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error al enviar Telegram:',
      expect.any(Error),
    );
  });
});
