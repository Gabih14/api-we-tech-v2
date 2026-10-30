import { ValidationPipe } from '@nestjs/common';
import { CancelarPedidoDto } from './cancelar-pedido.dto';
import { RecuperarPedidoDto } from './recuperar-pedido.dto';

describe('Validacion de transiciones de pedidos', () => {
  const pipe = new ValidationPipe({ transform: true });
  const cancelar = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CancelarPedidoDto });
  const recuperar = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: RecuperarPedidoDto });

  it('admite cuerpos anteriores sin motivo y recorta espacios', async () => {
    await expect(cancelar(undefined)).resolves.toMatchObject({});
    await expect(cancelar({ motivo: '  Sin stock  ' })).resolves.toMatchObject({
      motivo: 'Sin stock',
    });
    await expect(cancelar({ motivo: '   ' })).resolves.toMatchObject({
      motivo: '',
    });
  });

  it.each([3, {}, [], 'x'.repeat(256)])(
    'rechaza un motivo invalido: %p',
    async (motivo) => {
      await expect(cancelar({ motivo })).rejects.toThrow();
    },
  );

  it.each(['PENDIENTE', 'APROBADO'])('admite el destino %s', async (estado) => {
    await expect(recuperar({ estado })).resolves.toMatchObject({ estado });
  });

  it.each([undefined, null, {}, { estado: 'APROBADO_MANUAL' }, { estado: 1 }])(
    'rechaza una recuperacion invalida: %p',
    async (body) => {
      await expect(recuperar(body)).rejects.toThrow();
    },
  );
});
