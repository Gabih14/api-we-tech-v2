import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EstadoMayorista } from './entities/ecommerce-usuario.entity';
import { MayoristaGuard } from './mayorista.guard';

describe('MayoristaGuard', () => {
  const findByClerkUserId = jest.fn();
  const service = { findByClerkUserId } as unknown as EcommerceUsuariosService;
  const request = { clerkAuth: { userId: 'user_123', sessionId: 'sess_123' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (request as { ecommerceUsuario?: unknown }).ecommerceUsuario;
  });

  it('devuelve 401 si no se ejecuto la autenticacion Clerk', async () => {
    const anonymousContext = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    await expect(
      new MayoristaGuard(service).canActivate(anonymousContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    null,
    EstadoMayorista.NO_SOLICITADO,
    EstadoMayorista.PENDIENTE,
    EstadoMayorista.RECHAZADO,
    EstadoMayorista.SUSPENDIDO,
  ])('devuelve 403 para estado %s', async (estado) => {
    findByClerkUserId.mockResolvedValue(
      estado === null ? null : { id: 1, estadoMayorista: estado },
    );

    await expect(
      new MayoristaGuard(service).canActivate(context),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite y adjunta el usuario cuando esta APROBADO', async () => {
    const user = { id: 1, estadoMayorista: EstadoMayorista.APROBADO };
    findByClerkUserId.mockResolvedValue(user);

    await expect(
      new MayoristaGuard(service).canActivate(context),
    ).resolves.toBe(true);
    expect(request).toHaveProperty('ecommerceUsuario', user);
  });
});
