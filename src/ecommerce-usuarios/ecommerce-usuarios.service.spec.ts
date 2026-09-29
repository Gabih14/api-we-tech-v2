import { Repository } from 'typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import {
  EcommerceUsuario,
  EstadoMayorista,
} from './entities/ecommerce-usuario.entity';

describe('EcommerceUsuariosService', () => {
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
});
