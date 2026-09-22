// src/common/guards/api-token.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_TYPE_KEY,
  AuthType,
  AuthTypeRequirement,
} from '../decorators/auth-type.decorator';

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Tipo de auth requerido por metadata (clase o handler). Default si no hay.
    const authRequirement =
      this.reflector.getAllAndOverride<AuthTypeRequirement>(AUTH_TYPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'default';
    const requiredAuthTypes: AuthType[] = Array.isArray(authRequirement)
      ? authRequirement
      : [authRequirement];

    // Si es público, permitir el acceso sin token
    if (requiredAuthTypes.includes('public')) {
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
    const dashboardToken =
      this.configService.get<string>('DASHBOARD_API_TOKEN') ?? defaultToken;
    const readToken = this.configService.get<string>('READ_API_TOKEN');
    const writeToken = this.configService.get<string>('WRITE_API_TOKEN');

    if (requiredAuthTypes.length === 1) {
      const [requiredAuthType] = requiredAuthTypes;

      if (requiredAuthType === 'default' && token !== defaultToken) {
        throw new UnauthorizedException('Token inválido para API general');
      }

      if (requiredAuthType === 'nave' && token !== naveToken) {
        throw new UnauthorizedException('Token inválido para Nave');
      }

      if (requiredAuthType === 'dashboard' && token !== dashboardToken) {
        throw new UnauthorizedException('Token inválido para Dashboard');
      }

      if (requiredAuthType === 'read' && token !== readToken) {
        throw new UnauthorizedException('Token invalido para solo lectura');
      }

      if (requiredAuthType === 'write' && token !== writeToken) {
        throw new UnauthorizedException('Token invalido para escritura');
      }

      return true;
    }

    const tokensByAuthType: Partial<Record<AuthType, string | undefined>> = {
      default: defaultToken,
      nave: naveToken,
      dashboard: dashboardToken,
      read: readToken,
      write: writeToken,
    };

    if (
      requiredAuthTypes.some(
        (authType) => token === tokensByAuthType[authType],
      )
    ) {
      return true;
    }

    throw new UnauthorizedException('Token inválido para este recurso');
  }
}
