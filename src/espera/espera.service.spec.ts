import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkExistencia } from '../stk-existencia/entities/stk-existencia.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { DmEspera } from './entities/dm-espera.entity';
import { EsperaService } from './espera.service';

type MockRepository<T extends object = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const createRepositoryMock = <T extends object>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((entity) => entity),
  save: jest.fn(async (entity) => ({
    id: 1,
    avisado: 0,
    avisadoEn: null,
    usuario: 'web',
    creadoEn: new Date('2026-07-08T12:00:00.000Z'),
    ...entity,
  })),
});

describe('EsperaService', () => {
  let service: EsperaService;
  let esperaRepository: MockRepository<DmEspera>;
  let stkItemRepository: MockRepository<StkItem>;
  let stkExistenciaRepository: MockRepository<StkExistencia>;

  beforeEach(async () => {
    esperaRepository = createRepositoryMock<DmEspera>();
    stkItemRepository = createRepositoryMock<StkItem>();
    stkExistenciaRepository = createRepositoryMock<StkExistencia>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EsperaService,
        {
          provide: getRepositoryToken(DmEspera),
          useValue: esperaRepository,
        },
        {
          provide: getRepositoryToken(StkItem),
          useValue: stkItemRepository,
        },
        {
          provide: getRepositoryToken(StkExistencia),
          useValue: stkExistenciaRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(EsperaService);
  });

  it('crea una espera nueva para producto sin stock', async () => {
    stkItemRepository.findOne!.mockResolvedValue({
      id: 'G3-PLA1-1KG-NEGR',
      descripcion: 'Grilon3 | PLA | 1kg | Premium | Negro',
      grupo: 'FILAMENTOS',
    });
    stkExistenciaRepository.find!.mockResolvedValue([
      { cantidad: '0.0000', comprometido: '0.0000' },
    ]);
    esperaRepository.findOne!.mockResolvedValue(null);

    const result = await service.crear({
      producto_id: 'G3-PLA1-1KG-NEGR',
      cliente_id: '20244864121',
      cliente_nombre: 'Federico Polizzi',
      cliente_tel: '+542615546700',
      cantidad: 1,
    });

    expect(esperaRepository.create).toHaveBeenCalledWith({
      tipo: 'filamento',
      prod: 'Grilon3 | PLA | 1kg | Premium | Negro',
      clienteId: '20244864121',
      clienteNombre: 'Federico Polizzi',
      clienteTel: '+542615546700',
      cantidad: 1,
      nota: null,
      avisado: 0,
      avisadoEn: null,
      usuario: 'web',
    });
    expect(result).toMatchObject({
      id: 1,
      tipo: 'filamento',
      prod: 'Grilon3 | PLA | 1kg | Premium | Negro',
      cliente_id: '20244864121',
      cliente_nombre: 'Federico Polizzi',
      cliente_tel: '+542615546700',
      cantidad: 1,
      usuario: 'web',
    });
  });

  it('devuelve 404 si stk_item no existe', async () => {
    stkItemRepository.findOne!.mockResolvedValue(null);

    await expect(
      service.crear({
        producto_id: 'NO-EXISTE',
        cliente_nombre: 'Cliente',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve 409 si el producto tiene stock disponible', async () => {
    stkItemRepository.findOne!.mockResolvedValue({
      id: 'ITEM-1',
      descripcion: 'Producto',
      grupo: 'REPUESTOS',
    });
    stkExistenciaRepository.find!.mockResolvedValue([
      { cantidad: '3.0000', comprometido: '1.0000' },
    ]);

    await expect(
      service.crear({
        producto_id: 'ITEM-1',
        cliente_nombre: 'Cliente',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['FILAMENTOS', 'filamento'],
    ['IMPRESORAS', 'impresora'],
    ['REPUESTOS', 'repuesto'],
  ] as const)('deriva %s como %s', async (grupo, tipo) => {
    stkItemRepository.findOne!.mockResolvedValue({
      id: `ITEM-${grupo}`,
      descripcion: `Producto ${grupo}`,
      grupo,
    });
    stkExistenciaRepository.find!.mockResolvedValue([]);
    esperaRepository.findOne!.mockResolvedValue(null);

    const result = await service.crear({
      producto_id: `ITEM-${grupo}`,
      cliente_nombre: 'Cliente',
    });

    expect(result.tipo).toBe(tipo);
  });

  it('actualiza una espera pendiente existente sin duplicar', async () => {
    const existente = {
      id: 15,
      tipo: 'repuesto',
      prod: 'Repuesto sin stock',
      clienteId: '20244864121',
      clienteNombre: 'Nombre anterior',
      clienteTel: null,
      cantidad: 1,
      nota: null,
      avisado: 0,
      avisadoEn: null,
      usuario: 'martina',
      creadoEn: new Date('2026-07-08T10:00:00.000Z'),
    };
    stkItemRepository.findOne!.mockResolvedValue({
      id: 'REP-1',
      descripcion: 'Repuesto sin stock',
      grupo: 'REPUESTOS',
    });
    stkExistenciaRepository.find!.mockResolvedValue([]);
    esperaRepository.findOne!.mockResolvedValue(existente);

    await service.crear({
      producto_id: 'REP-1',
      cliente_id: '20244864121',
      cliente_nombre: 'Nombre nuevo',
      cliente_tel: '+542611111111',
      cantidad: 4,
      nota: 'Nueva nota',
    });

    expect(esperaRepository.create).not.toHaveBeenCalled();
    expect(esperaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 15,
        clienteNombre: 'Nombre nuevo',
        clienteTel: '+542611111111',
        cantidad: 4,
        nota: 'Nueva nota',
        usuario: 'web',
      }),
    );
  });

  it('usa telefono para detectar duplicado cuando no hay cliente_id', async () => {
    stkItemRepository.findOne!.mockResolvedValue({
      id: 'REP-2',
      descripcion: 'Otro repuesto',
      grupo: 'REPUESTOS',
    });
    stkExistenciaRepository.find!.mockResolvedValue([]);
    esperaRepository.findOne!.mockResolvedValue({
      id: 16,
      tipo: 'repuesto',
      prod: 'Otro repuesto',
      clienteId: null,
      clienteNombre: 'Cliente',
      clienteTel: '+542612222222',
      cantidad: 1,
      nota: null,
      avisado: 0,
      avisadoEn: null,
      usuario: 'web',
      creadoEn: new Date('2026-07-08T10:00:00.000Z'),
    });

    await service.crear({
      producto_id: 'REP-2',
      cliente_nombre: 'Cliente',
      cliente_tel: '+542612222222',
    });

    expect(esperaRepository.findOne).toHaveBeenCalledWith({
      where: {
        prod: 'Otro repuesto',
        clienteTel: '+542612222222',
        avisado: 0,
      },
    });
    expect(esperaRepository.create).not.toHaveBeenCalled();
  });
});
