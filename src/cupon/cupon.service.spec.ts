import { BadRequestException } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { Cupon } from './entities/cupon.entity';

describe('CuponService', () => {
  const createService = () => {
    const cupones = new Map<string, Partial<Cupon>>();
    const cuponRepository = {
      findOne: jest.fn(
        async ({ where }: { where: { id: string; activo?: boolean } }) => {
          const cupon = cupones.get(where.id);
          if (!cupon) {
            return null;
          }

          const resultado = { activo: true, usos: [], ...cupon } as Cupon;
          return where.activo === undefined || resultado.activo === where.activo
            ? resultado
            : null;
        },
      ),
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

  it('normaliza categoria general como cupon sin categoria especifica', async () => {
    const { service, cuponRepository } = createService();

    await service.crear({
      id: 'GENERAL',
      porcentajeDescuento: 10,
      categoria_aplicable: 'general',
    });

    expect(cuponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaAplicable: null,
      }),
    );
  });

  it('normaliza la categoria especifica al crear un cupon', async () => {
    const { service, cuponRepository } = createService();

    await service.crear({
      id: 'FILAMENTO',
      porcentajeDescuento: 10,
      categoria_aplicable: 'filamento',
    });

    expect(cuponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaAplicable: 'filamento',
      }),
    );
  });

  it('rechaza categorias de cupon invalidas', async () => {
    const { service } = createService();

    await expect(
      service.crear({
        id: 'INVALIDO',
        porcentajeDescuento: 10,
        categoria_aplicable: 'servicios',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite limpiar la categoria del cupon al actualizar', async () => {
    const { service, cupones, cuponRepository } = createService();
    cupones.set('FILAMENTO', {
      id: 'FILAMENTO',
      categoriaAplicable: 'filamento',
      porcentajeDescuento: 10,
      porcentajeDescuentoTarjeta: 10,
      porcentajeDescuentoTransferencia: 10,
    });

    await service.actualizar('FILAMENTO', {
      categoria_aplicable: 'general',
    });

    expect(cuponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriaAplicable: null,
      }),
    );
  });

  it('permite reactivar un cupon inactivo mediante PATCH', async () => {
    const { service, cupones, cuponRepository } = createService();
    cupones.set('BVVD20OFF', {
      id: 'BVVD20OFF',
      activo: false,
      porcentajeDescuento: 20,
      porcentajeDescuentoTarjeta: 20,
      porcentajeDescuentoTransferencia: 20,
    });

    await expect(
      service.actualizar('BVVD20OFF', { activo: true }),
    ).resolves.toEqual(expect.objectContaining({ activo: true }));

    expect(cuponRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'BVVD20OFF' },
      relations: ['usos'],
    });
    expect(cuponRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'BVVD20OFF',
        activo: true,
      }),
    );
  });

  it('mantiene los cupones inactivos fuera de la busqueda publica', async () => {
    const { service, cupones } = createService();
    cupones.set('BVVD20OFF', {
      id: 'BVVD20OFF',
      activo: false,
    });

    await expect(service.buscarPorId('BVVD20OFF')).rejects.toThrow(
      'Cupón BVVD20OFF no encontrado o inactivo',
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
