import 'reflect-metadata';

jest.mock('../../colors/colors.service', () => ({ ColorsService: class {} }));
jest.mock('../../colors/color-groups.service', () => ({
  ColorGroupsService: class {},
}));
jest.mock('../../cupon/cupon.service', () => ({ CuponService: class {} }));
jest.mock('../../pedido/pedido.service', () => ({ PedidoService: class {} }));
jest.mock('../../vta-comprobante/vta-comprobante.service', () => ({
  VtaComprobanteService: class {},
}));

import { ColorsController } from '../../colors/colors.controller';
import { ColorGroupsController } from '../../colors/color-groups.controller';
import { CuponController } from '../../cupon/cupon.controller';
import { PedidoController } from '../../pedido/pedido.controller';
import { VtaComprobanteController } from '../../vta-comprobante/vta-comprobante.controller';
import { AUTH_TYPE_KEY } from './auth-type.decorator';

describe('grouped endpoint auth types', () => {
  const readOnlyHandlers = [
    ColorGroupsController.prototype.findAll,
    ColorsController.prototype.findAll,
    CuponController.prototype.listarActivos,
    CuponController.prototype.obtenerEstadisticas,
    VtaComprobanteController.prototype.getResumen,
    VtaComprobanteController.prototype.getVentasMensuales,
    VtaComprobanteController.prototype.getVentasPorVendedor,
    PedidoController.prototype.getByExternalId,
  ];

  const writeOnlyHandlers = [
    CuponController.prototype.crear,
    CuponController.prototype.actualizar,
    CuponController.prototype.desactivar,
    ColorsController.prototype.create,
    ColorsController.prototype.update,
    ColorGroupsController.prototype.create,
    ColorGroupsController.prototype.update,
    PedidoController.prototype.cancelarPedido,
    PedidoController.prototype.rechazarTransferencia,
  ];

  it.each(readOnlyHandlers)(
    'requires explicit read auth for %p',
    (handler) => {
      expect(Reflect.getMetadata(AUTH_TYPE_KEY, handler)).toBe('read');
    },
  );

  it.each(writeOnlyHandlers)(
    'requires explicit write auth for %p',
    (handler) => {
      expect(Reflect.getMetadata(AUTH_TYPE_KEY, handler)).toBe('write');
    },
  );
});
