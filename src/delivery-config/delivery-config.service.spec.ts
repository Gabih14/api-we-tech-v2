import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeliveryConfigService } from './delivery-config.service';
import { DeliveryConfig } from './entities/delivery-config.entity';

describe('DeliveryConfigService', () => {
  let service: DeliveryConfigService;
  let repository: jest.Mocked<
    Pick<
      Repository<DeliveryConfig>,
      'create' | 'save' | 'find' | 'findOne' | 'remove'
    >
  >;
  let stkItemRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  const config: DeliveryConfig = {
    id: 1,
    telefono: '2615551234',
    api_key: 'secret',
    descripcion: 'Delivery Mendoza',
    actualizado_en: new Date('2026-08-24T12:00:00Z'),
    item: 'ENV-07K-GM-DELIVERY',
    provincia: 'Mendoza',
    departamento: 'Capital',
    kms: 7,
    activo: true,
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    stkItemRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    service = new DeliveryConfigService(
      repository as unknown as Repository<DeliveryConfig>,
      stkItemRepository as any,
    );
  });

  it('crea una configuracion normalizando strings', async () => {
    repository.create.mockImplementation((value) => value as DeliveryConfig);
    repository.save.mockResolvedValue(config);

    await expect(
      service.create({
        telefono: ' 2615551234 ',
        api_key: ' secret ',
        descripcion: ' Delivery Mendoza ',
        kms: 7,
      }),
    ).resolves.toBe(config);

    expect(repository.create).toHaveBeenCalledWith({
      telefono: '2615551234',
      api_key: 'secret',
      descripcion: 'Delivery Mendoza',
      kms: 7,
    });
  });

  it('lista las configuraciones ordenadas por id', async () => {
    repository.find.mockResolvedValue([config]);

    await expect(service.findAll()).resolves.toEqual([config]);
    expect(repository.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
  });

  it('devuelve 404 cuando la configuracion no existe', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza una configuracion existente', async () => {
    repository.findOne.mockResolvedValue({ ...config });
    repository.save.mockImplementation(
      async (value) => value as DeliveryConfig,
    );

    const result = await service.update(1, {
      descripcion: ' Nueva descripcion ',
      departamento: null,
    });

    expect(result.descripcion).toBe('Nueva descripcion');
    expect(result.departamento).toBeNull();
  });

  it('elimina una configuracion existente', async () => {
    repository.findOne.mockResolvedValue(config);
    repository.remove.mockResolvedValue(config);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(config);
  });

  it('elige el menor producto ENV que cubre la distancia', async () => {
    stkItemRepository.find.mockResolvedValue([
      itemEnv('ENV-20K-GM-DELIVERY', '2000'),
      itemEnv('ENV-05K-GM-DELIVERY', '500'),
      itemEnv('ENV-10K-GM-DELIVERY', '1000'),
    ]);

    await expect(
      service.cotizarEnvio(7, 'Mendoza', 'Capital'),
    ).resolves.toEqual(
      expect.objectContaining({
        itemId: 'ENV-10K-GM-DELIVERY',
        costoTotal: 1000,
        origen: 'env',
        deliveryConfigId: null,
      }),
    );
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('usa la configuracion geografica mas especifica cuando no hay ENV aplicable', async () => {
    stkItemRepository.find.mockResolvedValue([]);
    repository.find.mockResolvedValue([
      configFor(1, null, null, 40, 'ENV-GLOBAL'),
      configFor(2, 'Mendoza', null, 50, 'ENV-PROVINCIA'),
      configFor(3, null, 'Capital', 45, 'ENV-DEPARTAMENTO'),
      configFor(4, 'Méndoza', 'Cápital', 60, 'ENV-ESPECIFICO'),
    ]);
    stkItemRepository.findOne.mockResolvedValue(
      itemEnv('ENV-ESPECIFICO', '6000'),
    );

    await expect(
      service.cotizarEnvio(30, 'mendoza', 'capital'),
    ).resolves.toEqual(
      expect.objectContaining({
        itemId: 'ENV-ESPECIFICO',
        origen: 'delivery_config',
        deliveryConfigId: 4,
      }),
    );
  });

  it('elige el menor rango dentro de la misma prioridad', async () => {
    stkItemRepository.find.mockResolvedValue([]);
    repository.find.mockResolvedValue([
      configFor(10, null, null, 80, 'ENV-GLOBAL-80'),
      configFor(11, null, null, 50, 'ENV-GLOBAL-50'),
    ]);
    stkItemRepository.findOne.mockResolvedValue(
      itemEnv('ENV-GLOBAL-50', '5000'),
    );

    const quote = await service.cotizarEnvio(30);

    expect(quote.deliveryConfigId).toBe(11);
    expect(quote.itemId).toBe('ENV-GLOBAL-50');
  });

  it('devuelve 404 si ningun ENV ni configuracion cubren el envio', async () => {
    stkItemRepository.find.mockResolvedValue([]);
    repository.find.mockResolvedValue([]);

    await expect(
      service.cotizarEnvio(200, 'Mendoza', 'Capital'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  function itemEnv(id: string, precioVta: string): any {
    return {
      id,
      descripcion: `Envio ${id}`,
      stkPrecios: [
        {
          lista: 'MINORISTA',
          precioVta,
          moneda: { id: 'PES', cotizacion: '1' },
        },
      ],
    };
  }

  function configFor(
    id: number,
    provincia: string | null,
    departamento: string | null,
    kms: number,
    item: string,
  ): DeliveryConfig {
    return {
      ...config,
      id,
      provincia,
      departamento,
      kms,
      item,
    };
  }
});
