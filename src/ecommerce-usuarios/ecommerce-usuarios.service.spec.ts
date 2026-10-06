import { Repository } from 'typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import {
  EcommerceUsuario,
  EstadoMayorista,
  FiguraFiscalComercial,
  OfertaPublico,
  PerfilCompraInicial,
  SedeComercial,
} from './entities/ecommerce-usuario.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClerkService } from '../auth/clerk.service';

describe('EcommerceUsuariosService', () => {
  const clerk = {
    client: { users: { getUserList: jest.fn() } },
  } as unknown as ClerkService;

  beforeEach(() => jest.clearAllMocks());

  it('lista usuarios paginados y permite filtrar por estado', async () => {
    const users = [
      { id: 2, clerkUserId: 'user_2' },
      { id: 1, clerkUserId: 'user_1' },
    ] as EcommerceUsuario[];
    const findAndCount = jest.fn().mockResolvedValue([users, 22]);
    const repository = {
      findAndCount,
    } as unknown as Repository<EcommerceUsuario>;
    (clerk.client.users.getUserList as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'user_2',
          firstName: 'Ana',
          lastName: 'Pérez',
          primaryEmailAddressId: 'email_2',
          emailAddresses: [{ id: 'email_2', emailAddress: 'ana@example.com' }],
        },
      ],
    });
    const service = new EcommerceUsuariosService(repository, clerk);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        estado: EstadoMayorista.PENDIENTE,
      }),
    ).resolves.toEqual({
      data: [
        {
          id: 2,
          clerkUserId: 'user_2',
          email: 'ana@example.com',
          nombre: 'Ana Pérez',
        },
        {
          id: 1,
          clerkUserId: 'user_1',
          email: null,
          nombre: null,
        },
      ],
      pagination: { page: 2, limit: 10, total: 22, totalPages: 3 },
    });
    expect(findAndCount).toHaveBeenCalledWith({
      where: { estadoMayorista: EstadoMayorista.PENDIENTE },
      order: { createdAt: 'DESC' },
      skip: 10,
      take: 10,
    });
    expect(clerk.client.users.getUserList).toHaveBeenCalledWith({
      userId: ['user_2', 'user_1'],
      limit: 2,
    });
  });

  it('obtiene un usuario por id', async () => {
    const user = { id: 7 } as EcommerceUsuario;
    const findOne = jest.fn().mockResolvedValue(user);
    const repository = { findOne } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);

    await expect(service.findOneById(7)).resolves.toBe(user);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('ignora duplicados sin pedirle a TypeORM actualizar una entidad sin id', async () => {
    const existingUser = {
      id: 1,
      clerkUserId: 'user_123',
      clienteId: null,
      estadoMayorista: EstadoMayorista.NO_SOLICITADO,
    } as EcommerceUsuario;
    const queryBuilder = {
      insert: jest.fn(),
      into: jest.fn(),
      values: jest.fn(),
      orIgnore: jest.fn(),
      updateEntity: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    Object.values(queryBuilder).forEach((method) => {
      if (method !== queryBuilder.execute) {
        method.mockReturnValue(queryBuilder);
      }
    });
    const findOne = jest.fn().mockResolvedValue(existingUser);
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne,
    } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);

    await expect(service.findOrCreateByClerkUserId('user_123')).resolves.toBe(
      existingUser,
    );
    expect(queryBuilder.orIgnore).toHaveBeenCalled();
    expect(queryBuilder.updateEntity).toHaveBeenCalledWith(false);
    expect(findOne).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_123' },
    });
  });

  it('actualiza el estado mayorista de un usuario existente', async () => {
    const user = {
      id: 7,
      clerkUserId: 'user_approved',
      estadoMayorista: EstadoMayorista.PENDIENTE,
    } as EcommerceUsuario;
    const findOne = jest.fn().mockResolvedValue(user);
    const save = jest
      .fn<Promise<EcommerceUsuario>, [EcommerceUsuario]>()
      .mockResolvedValue(user);
    const repository = {
      findOne,
      save,
    } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);

    await expect(
      service.updateEstadoMayorista(7, EstadoMayorista.APROBADO),
    ).resolves.toMatchObject({ estadoMayorista: EstadoMayorista.APROBADO });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(save).toHaveBeenCalledWith(user);
  });

  it('guarda la solicitud y pasa el usuario a pendiente', async () => {
    const user = {
      id: 7,
      clerkUserId: 'user_123',
      estadoMayorista: EstadoMayorista.NO_SOLICITADO,
    } as EcommerceUsuario;
    const updatedUser = {
      ...user,
      nombreComercio: 'Impresiones Cuyo',
      personaResponsable: 'Ana Perez',
      ubicacionZona: 'Godoy Cruz, Mendoza',
      telefono: '2615551234',
      figuraFiscalComercial: FiguraFiscalComercial.EMPRENDEDOR_MONOTRIBUTISTA,
      perfilCompraInicial: PerfilCompraInicial.GRAN_CONSUMIDOR_FINAL_96_239_KG,
      sedeComercial: SedeComercial.TALLER_OFICINA,
      ofertasPublico: [
        OfertaPublico.SERVICIO_IMPRESION_3D,
        OfertaPublico.VENTA_ACTUAL_FILAMENTOS,
      ],
      marcasFilamento: 'WeTech, Grilon3',
      estadoMayorista: EstadoMayorista.PENDIENTE,
    } as EcommerceUsuario;
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const repository = { update } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);
    jest.spyOn(service, 'findOrCreateByClerkUserId').mockResolvedValue(user);
    jest.spyOn(service, 'findOneById').mockResolvedValue(updatedUser);

    await expect(
      service.solicitarMayorista('user_123', {
        nombreComercio: 'Impresiones Cuyo',
        personaResponsable: 'Ana Perez',
        ubicacionZona: 'Godoy Cruz, Mendoza',
        telefono: '2615551234',
        figuraFiscalComercial: FiguraFiscalComercial.EMPRENDEDOR_MONOTRIBUTISTA,
        perfilCompraInicial:
          PerfilCompraInicial.GRAN_CONSUMIDOR_FINAL_96_239_KG,
        sedeComercial: SedeComercial.TALLER_OFICINA,
        ofertasPublico: [
          OfertaPublico.SERVICIO_IMPRESION_3D,
          OfertaPublico.VENTA_ACTUAL_FILAMENTOS,
        ],
        marcasFilamento: 'WeTech, Grilon3',
      }),
    ).resolves.toMatchObject({
      nombreComercio: 'Impresiones Cuyo',
      personaResponsable: 'Ana Perez',
      telefono: '2615551234',
      estadoMayorista: EstadoMayorista.PENDIENTE,
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), {
      nombreComercio: 'Impresiones Cuyo',
      personaResponsable: 'Ana Perez',
      ubicacionZona: 'Godoy Cruz, Mendoza',
      telefono: '2615551234',
      figuraFiscalComercial: FiguraFiscalComercial.EMPRENDEDOR_MONOTRIBUTISTA,
      perfilCompraInicial: PerfilCompraInicial.GRAN_CONSUMIDOR_FINAL_96_239_KG,
      sedeComercial: SedeComercial.TALLER_OFICINA,
      ofertasPublico: [
        OfertaPublico.SERVICIO_IMPRESION_3D,
        OfertaPublico.VENTA_ACTUAL_FILAMENTOS,
      ],
      marcasFilamento: 'WeTech, Grilon3',
      estadoMayorista: EstadoMayorista.PENDIENTE,
    });
  });

  it('rechaza una solicitud si el usuario ya esta pendiente', async () => {
    const repository = {} as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);
    jest.spyOn(service, 'findOrCreateByClerkUserId').mockResolvedValue({
      id: 7,
      estadoMayorista: EstadoMayorista.PENDIENTE,
    } as EcommerceUsuario);

    await expect(
      service.solicitarMayorista('user_123', {
        nombreComercio: 'Impresiones Cuyo',
        personaResponsable: 'Ana Perez',
        ubicacionZona: 'Godoy Cruz, Mendoza',
        telefono: '2615551234',
        figuraFiscalComercial: FiguraFiscalComercial.EMPRENDEDOR_MONOTRIBUTISTA,
        perfilCompraInicial:
          PerfilCompraInicial.GRAN_CONSUMIDOR_FINAL_96_239_KG,
        sedeComercial: SedeComercial.TALLER_OFICINA,
        ofertasPublico: [OfertaPublico.SERVICIO_IMPRESION_3D],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('devuelve 404 si el usuario ecommerce no existe', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository, clerk);

    await expect(
      service.updateEstadoMayorista(999, EstadoMayorista.APROBADO),
    ).rejects.toThrow(NotFoundException);
  });
});
