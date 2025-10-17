// src/common/guards/api-token.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AUTH_TYPE_KEY, AuthType } from '../decorators/auth-type.decorator';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Tipo de auth requerido por metadata (clase o handler). Default si no hay.
    const requiredAuthType =
      this.reflector.getAllAndOverride<AuthType>(AUTH_TYPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'default';

    // Si es público, permitir el acceso sin token
    if (requiredAuthType === 'public') {
      return true;
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Falta el header Authorization');

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato inválido. Usa "Bearer <token>"');
    }

    // Tokens desde variables de entorno
    const defaultToken = this.configService.get<string>('API_TOKEN');
    const naveToken = this.configService.get<string>('NAVE_WEBHOOK_TOKEN');

    if (requiredAuthType === 'default' && token !== defaultToken) {
      throw new UnauthorizedException('Token inválido para API general');
    }

    if (requiredAuthType === 'nave' && token !== naveToken) {
      throw new UnauthorizedException('Token inválido para Nave');
    }

    return true;
  }
}
