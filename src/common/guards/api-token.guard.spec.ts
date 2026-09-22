import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiTokenGuard } from './api-token.guard';

describe('ApiTokenGuard con múltiples tipos de autenticación', () => {
  const tokens: Record<string, string> = {
    API_TOKEN: 'api-token',
    DASHBOARD_API_TOKEN: 'dashboard-token',
  };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(['default', 'dashboard']),
  } as unknown as Reflector;
  const configService = {
    get: jest.fn((key: string) => tokens[key]),
  } as unknown as ConfigService;

  const contextWithToken = (token: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  it.each(['api-token', 'dashboard-token'])(
    'acepta el token permitido %s',
    (token) => {
      const guard = new ApiTokenGuard(reflector, configService);

      expect(guard.canActivate(contextWithToken(token))).toBe(true);
    },
  );

  it('rechaza un token que no pertenece a ningún tipo permitido', () => {
    const guard = new ApiTokenGuard(reflector, configService);

    expect(() => guard.canActivate(contextWithToken('otro-token'))).toThrow(
      UnauthorizedException,
    );
  });
});
