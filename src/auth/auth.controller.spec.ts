import { AuthController } from './auth.controller';
import { EcommerceUsuariosService } from '../ecommerce-usuarios/ecommerce-usuarios.service';
import { EstadoMayorista } from '../ecommerce-usuarios/entities/ecommerce-usuario.entity';
import { AuthenticatedRequest } from './authenticated-request';

describe('AuthController', () => {
  it('/auth/me funciona aunque el usuario no sea mayorista', async () => {
    const service = {
      findOrCreateByClerkUserId: jest.fn().mockResolvedValue({
        clienteId: null,
        estadoMayorista: EstadoMayorista.PENDIENTE,
      }),
    } as unknown as EcommerceUsuariosService;
    const controller = new AuthController(service);
    const request = {
      clerkAuth: { userId: 'user_123', sessionId: 'sess_123' },
    } as AuthenticatedRequest;

    await expect(controller.me(request)).resolves.toEqual({
      authenticated: true,
      userId: 'user_123',
      customer: { id: null, wholesaleStatus: EstadoMayorista.PENDIENTE },
    });
  });
});
