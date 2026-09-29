import { Repository } from 'typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import {
  EcommerceUsuario,
  EstadoMayorista,
} from './entities/ecommerce-usuario.entity';
import { NotFoundException } from '@nestjs/common';

describe('EcommerceUsuariosService', () => {
  it('lista usuarios paginados y permite filtrar por estado', async () => {
    const users = [{ id: 2 }, { id: 1 }] as EcommerceUsuario[];
    const findAndCount = jest.fn().mockResolvedValue([users, 22]);
    const repository = {
      findAndCount,
    } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository);

    await expect(
      service.findAll({
        page: 2,
        limit: 10,
        estado: EstadoMayorista.PENDIENTE,
      }),
    ).resolves.toEqual({
      data: users,
      pagination: { page: 2, limit: 10, total: 22, totalPages: 3 },
    });
    expect(findAndCount).toHaveBeenCalledWith({
      where: { estadoMayorista: EstadoMayorista.PENDIENTE },
      order: { createdAt: 'DESC' },
      skip: 10,
      take: 10,
    });
  });

  it('obtiene un usuario por id', async () => {
    const user = { id: 7 } as EcommerceUsuario;
    const findOne = jest.fn().mockResolvedValue(user);
    const repository = { findOne } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository);

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
    const service = new EcommerceUsuariosService(repository);

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
    const service = new EcommerceUsuariosService(repository);

    await expect(
      service.updateEstadoMayorista(7, EstadoMayorista.APROBADO),
    ).resolves.toMatchObject({ estadoMayorista: EstadoMayorista.APROBADO });
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(save).toHaveBeenCalledWith(user);
  });

  it('devuelve 404 si el usuario ecommerce no existe', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<EcommerceUsuario>;
    const service = new EcommerceUsuariosService(repository);

    await expect(
      service.updateEstadoMayorista(999, EstadoMayorista.APROBADO),
    ).rejects.toThrow(NotFoundException);
  });
});
