import { BadRequestException } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { Cupon } from './entities/cupon.entity';

describe('CuponService', () => {
  const createService = () => {
    const cupones = new Map<string, Partial<Cupon>>();
    const cuponUsoQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(async () => 0),
    };
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
      createQueryBuilder: jest.fn(() => cuponUsoQueryBuilder),
    };

    const service = new CuponService(
      cuponRepository as any,
      cuponUsoRepository as any,
    );

    return {
      service,
      cupones,
      cuponRepository,
      cuponUsoRepository,
      cuponUsoQueryBuilder,
    };
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
    ).resolves.toEqual(
      expect.objectContaining({
        estado: 'VALID',
        codigoCupon: 'UNICUIT',
        fechaVencimiento: null,
      }),
    );
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

  it('devuelve el vencimiento cuando el cupon es valido', async () => {
    const { service, cupones } = createService();
    const fechaHasta = new Date('2099-12-31T23:59:59.000Z');
    cupones.set('VALIDO', {
      id: 'VALIDO',
      fechaHasta,
      categoriaAplicable: 'filamento',
    });

    await expect(
      service.validarUsoCupon({ cupon_id: 'VALIDO', cuit: '20123456789' }),
    ).resolves.toEqual({
      estado: 'VALID',
      codigoCupon: 'VALIDO',
      fechaVencimiento: fechaHasta,
      categoriaAplicable: 'filamento',
    });
  });

  it('devuelve COUPON_EXPIRED con la fecha de vencimiento', async () => {
    const { service, cupones } = createService();
    const fechaHasta = new Date('2020-01-01T00:00:00.000Z');
    cupones.set('VENCIDO', { id: 'VENCIDO', fechaHasta });

    try {
      await service.validarUsoCupon({
        cupon_id: 'VENCIDO',
        cuit: '20123456789',
      });
      throw new Error('La validacion debio fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'COUPON_EXPIRED',
          details: { fechaVencimiento: fechaHasta },
        }),
      );
    }
  });

  it('devuelve COUPON_ALREADY_USED solo para limite por CUIT igual a uno', async () => {
    const { service, cupones, cuponUsoQueryBuilder } = createService();
    const fechaUso = new Date('2026-10-10T12:00:00.000Z');
    cuponUsoQueryBuilder.getCount.mockResolvedValue(1);
    cupones.set('UNSOLOUSO', {
      id: 'UNSOLOUSO',
      maxUsosPorCuit: 1,
      usos: [
        {
          cuit: '20-12345678-9',
          pedidoId: 123,
          usadoEn: fechaUso,
        } as any,
      ],
    });

    try {
      await service.validarUsoCupon({
        cupon_id: 'UNSOLOUSO',
        cuit: '20123456789',
      });
      throw new Error('La validacion debio fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'COUPON_ALREADY_USED',
          details: { fechaUso, pedidoId: 123 },
        }),
      );
    }
  });

  it('no usa COUPON_ALREADY_USED para cupones con mas de un uso permitido', async () => {
    const { service, cupones, cuponUsoQueryBuilder } = createService();
    cuponUsoQueryBuilder.getCount.mockResolvedValue(2);
    cupones.set('MULTIUSO', {
      id: 'MULTIUSO',
      maxUsosPorCuit: 2,
    });

    try {
      await service.validarUsoCupon({
        cupon_id: 'MULTIUSO',
        cuit: '20123456789',
      });
      throw new Error('La validacion debio fallar');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).not.toEqual(
        expect.objectContaining({ code: 'COUPON_ALREADY_USED' }),
      );
    }
  });
});
