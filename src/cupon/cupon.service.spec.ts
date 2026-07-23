import { BadRequestException } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { Cupon } from './entities/cupon.entity';

describe('CuponService', () => {
  const createService = () => {
    const cupones = new Map<string, Partial<Cupon>>();
    const cuponRepository = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
        const cupon = cupones.get(where.id);
        return cupon ? ({ activo: true, usos: [], ...cupon } as Cupon) : null;
      }),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (cupon) => {
        cupones.set(cupon.id, cupon);
        return cupon;
      }),
    };
    const cuponUsoRepository = {
      findOne: jest.fn(async () => null),
      count: jest.fn(async () => 0),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (uso) => uso),
      createQueryBuilder: jest.fn(),
    };

    const service = new CuponService(
      cuponRepository as any,
      cuponUsoRepository as any,
    );

    return { service, cupones, cuponRepository, cuponUsoRepository };
  };

  it('normaliza el CUIT habilitado al crear un cupon', async () => {
    const { service, cuponRepository } = createService();

    await service.crear({
      id: 'UNICUIT',
      porcentajeDescuento: 10,
      cuit_habilitado: '20-12345678-9',
    });

    expect(cuponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cuitHabilitado: '20123456789',
      }),
    );
  });

  it('permite usar el cupon si el CUIT coincide aunque venga formateado', async () => {
    const { service, cupones } = createService();
    cupones.set('UNICUIT', {
      id: 'UNICUIT',
      cuitHabilitado: '20123456789',
      porcentajeDescuento: 10,
      porcentajeDescuentoTarjeta: 10,
      porcentajeDescuentoTransferencia: 10,
    });

    await expect(
      service.validarUsoCupon({
        cupon_id: 'UNICUIT',
        cuit: '20-12345678-9',
      }),
    ).resolves.toBeUndefined();
  });

  it('rechaza el cupon si el CUIT no coincide con el habilitado', async () => {
    const { service, cupones } = createService();
    cupones.set('UNICUIT', {
      id: 'UNICUIT',
      cuitHabilitado: '20123456789',
      porcentajeDescuento: 10,
      porcentajeDescuentoTarjeta: 10,
      porcentajeDescuentoTransferencia: 10,
    });

    await expect(
      service.validarUsoCupon({
        cupon_id: 'UNICUIT',
        cuit: '27-87654321-0',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
