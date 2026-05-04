import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeEach(() => {
    service = new WhatsappService({ get: jest.fn() } as unknown as ConfigService);
  });

  describe('formatearMensajeParaDelivery', () => {
    const pedidoBase = {
      cliente_nombre: 'Juan Perez',
      cliente_ubicacion: 'Av. Siempre Viva 742, Springfield, Buenos Aires, Argentina, 1000',
      costo_envio: 1500,
      observaciones_direccion: 'Tocar timbre 2B',
      comprobante_tipo: 'FA',
      comprobante_numero: '0001-00001234',
      external_id: 'pedido-123',
    };

    it('incluye el link de Google Maps con la ubicacion codificada', () => {
      const mensaje = service.formatearMensajeParaDelivery(pedidoBase);
      const linkEsperado = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        pedidoBase.cliente_ubicacion,
      )}`;

      expect(mensaje).toContain('*Cliente:* Juan Perez');
      expect(mensaje).toContain(`*Ubicación:* ${pedidoBase.cliente_ubicacion}`);
      expect(mensaje).toContain(`*Maps:* ${linkEsperado}`);
      expect(mensaje).toContain('*Costo envío:* $1500.00');
      expect(mensaje).toContain('*Comprobante:* FA 0001-00001234');
      expect(mensaje).toContain('ID: pedido-123');
    });

    it('no incluye la linea de Maps cuando no hay ubicacion real', () => {
      const mensaje = service.formatearMensajeParaDelivery({
        ...pedidoBase,
        cliente_ubicacion: '   ',
      });

      expect(mensaje).toContain('*Ubicación:* Sin ubicación proporcionada');
      expect(mensaje).not.toContain('*Maps:*');
      expect(mensaje).not.toContain('google.com/maps');
    });
  });
});
