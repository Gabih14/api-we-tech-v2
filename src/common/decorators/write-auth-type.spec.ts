import 'reflect-metadata';

jest.mock('../../colors/colors.service', () => ({ ColorsService: class {} }));
jest.mock('../../colors/color-groups.service', () => ({
  ColorGroupsService: class {},
}));
jest.mock('../../cupon/cupon.service', () => ({ CuponService: class {} }));
jest.mock('../../pedido/pedido.service', () => ({ PedidoService: class {} }));

import { ColorsController } from '../../colors/colors.controller';
import { ColorGroupsController } from '../../colors/color-groups.controller';
import { CuponController } from '../../cupon/cupon.controller';
import { PedidoController } from '../../pedido/pedido.controller';
import { AUTH_TYPE_KEY } from './auth-type.decorator';

describe('write endpoint auth types', () => {
  const defaultOnlyHandlers = [
    CuponController.prototype.crear,
    CuponController.prototype.actualizar,
    CuponController.prototype.usarCupon,
    CuponController.prototype.desactivar,
    ColorsController.prototype.create,
    ColorsController.prototype.update,
    ColorGroupsController.prototype.create,
    ColorGroupsController.prototype.update,
    PedidoController.prototype.crear,
    PedidoController.prototype.cancelarPedido,
    PedidoController.prototype.rechazarTransferencia,
  ];

  it.each(defaultOnlyHandlers)(
    'requires explicit default auth for %p',
    (handler) => {
      expect(Reflect.getMetadata(AUTH_TYPE_KEY, handler)).toBe('default');
    },
  );
});
