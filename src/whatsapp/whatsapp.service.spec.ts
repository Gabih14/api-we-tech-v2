import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  let service: WhatsappService;
  const pedidoBase = {
    cliente_nombre: 'Juan Perez',
    telefono: '+5491123456789',
    cliente_ubicacion: 'Av. Siempre Viva 742, Springfield, Buenos Aires, Argentina, 1000',
    costo_envio: 1500,
    observaciones_direccion: 'Tocar timbre 2B',
    comprobante_tipo: 'FA',
    comprobante_numero: '0001-00001234',
    external_id: 'pedido-123',
    cliente_cuit: '20123456789',
    cliente_mail: 'juan@example.com',
    delivery_method: 'shipping',
    total: 1280000,
    productos: [
      { nombre: 'Notebook Lenovo', cantidad: 1, precio_unitario: 1250000 },
      { nombre: 'Mouse Logitech', cantidad: 2, precio_unitario: 15000 },
    ],
  };

  beforeEach(() => {
    service = new WhatsappService({ get: jest.fn() } as unknown as ConfigService);
  });

  it('usa telefono en lugar de email en el mensaje de pedido aprobado', () => {
    const mensaje = service.formatearMensajePedido(pedidoBase);

    expect(mensaje).toContain('*Telefono:* +5491123456789');
    expect(mensaje).not.toContain('*Email:*');
    expect(mensaje).not.toContain('juan@example.com');
  });

  it('usa telefono en lugar de email en el mensaje de transferencia pendiente', () => {
    const mensaje = service.formatearMensajeTransferenciaPendiente(pedidoBase);

    expect(mensaje).toContain('*Telefono:* +5491123456789');
    expect(mensaje).not.toContain('*Email:*');
    expect(mensaje).not.toContain('juan@example.com');
  });

  describe('formatearMensajeParaDelivery', () => {
    it('incluye el link de Google Maps con la ubicacion codificada', () => {
      const mensaje = service.formatearMensajeParaDelivery(pedidoBase);
      const linkEsperado = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        pedidoBase.cliente_ubicacion,
      )}`;

      expect(mensaje).toContain('*Cliente:* Juan Perez');
      expect(mensaje).toContain('*Telefono:* +5491123456789');
      expect(mensaje).toContain(`*Ubicación:* ${pedidoBase.cliente_ubicacion}`);
      expect(mensaje).toContain(`*Maps:* ${linkEsperado}`);
      expect(mensaje).toContain('*Costo envío:* $1500.00');
      expect(mensaje).toContain('*Productos:*');
      expect(mensaje).toContain('- Notebook Lenovo x1 - Neto u. $1250000.00');
      expect(mensaje).toContain('- Mouse Logitech x2 - Neto u. $15000.00');
      expect(mensaje).toContain('FA 0001-00001234');
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
