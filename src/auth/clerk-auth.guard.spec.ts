import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';

describe('ClerkAuthGuard', () => {
  const authenticateRequest = jest.fn();
  const clerk = {
    client: { authenticateRequest },
    authorizedParties: ['http://localhost:5173'],
    publishableKey: 'pk_test_example',
  } as unknown as ClerkService;

  const context = (authorization?: string) => {
    const request = {
      protocol: 'http',
      method: 'GET',
      originalUrl: '/auth/me',
      headers: authorization ? { authorization } : {},
      get: (name: string) =>
        name.toLowerCase() === 'host'
          ? 'localhost:3000'
          : name.toLowerCase() === 'authorization'
            ? authorization
            : undefined,
    };
    return {
      request,
      executionContext: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('devuelve 401 cuando no hay token', async () => {
    const guard = new ClerkAuthGuard(clerk);
    await expect(guard.canActivate(context().executionContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('devuelve 401 cuando Clerk rechaza el token', async () => {
    authenticateRequest.mockResolvedValue({ isAuthenticated: false });
    const guard = new ClerkAuthGuard(clerk);

    await expect(
      guard.canActivate(context('Bearer invalid').executionContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('adjunta al request la identidad verificada por Clerk', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_123', sessionId: 'sess_123' }),
    });
    const guard = new ClerkAuthGuard(clerk);
    const { request, executionContext } = context('Bearer valid');

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request).toHaveProperty('clerkAuth', {
      userId: 'user_123',
      sessionId: 'sess_123',
    });
  });
});
