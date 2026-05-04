import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string) => {
        const values = {
          TELEGRAM_BOT_TOKEN: 'bot-token',
          TELEGRAM_CHAT_ID: 'chat-id',
          DELIVERY_TELEGRAM_CHAT_ID: 'delivery-chat-id',
        };

        return values[key];
      }),
    } as unknown as ConfigService;

    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    service = new TelegramService(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('envia el mensaje normalizado como HTML para Telegram', async () => {
    await service.enviarMensaje('🚚 *Cliente:* Juan\n📍 *Ubicación:* Calle 123');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.chat_id).toBe('chat-id');
    expect(body.parse_mode).toBe('HTML');
    expect(body.disable_web_page_preview).toBe(true);
    expect(body.text).toContain('<b>Cliente:</b> Juan');
    expect(body.text).toContain('<b>Ubicación:</b> Calle 123');
    expect(body.text).not.toContain('🚚');
    expect(body.text).not.toContain('📍');
    expect(body.text).not.toContain('*Cliente:*');
  });

  it('escapa HTML antes de aplicar el formato de Telegram', async () => {
    await service.enviarMensajeDelivery('*Cliente:* <Juan & Asociados>');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.chat_id).toBe('delivery-chat-id');
    expect(body.text).toBe('<b>Cliente:</b> &lt;Juan &amp; Asociados&gt;');
  });
});
