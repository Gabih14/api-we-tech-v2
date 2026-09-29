import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClerkService } from './clerk.service';
import { AuthenticatedRequest } from './authenticated-request';

interface VerifiedSessionAuth {
  userId: string | null;
  sessionId: string | null;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly clerk: ClerkService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta un token de sesion Clerk valido');
    }

    try {
      const requestState = await this.clerk.client.authenticateRequest(
        this.toWebRequest(request),
        {
          acceptsToken: 'session_token',
          authorizedParties: this.clerk.authorizedParties,
          publishableKey: this.clerk.publishableKey,
        },
      );

      if (!requestState.isAuthenticated) {
        throw new UnauthorizedException('Token Clerk invalido o expirado');
      }

      const auth = requestState.toAuth() as unknown as VerifiedSessionAuth;
      if (!auth.userId || !auth.sessionId) {
        throw new UnauthorizedException(
          'Sesion Clerk sin identidad de usuario',
        );
      }

      request.clerkAuth = {
        userId: auth.userId,
        sessionId: auth.sessionId,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token Clerk invalido o expirado');
    }
  }

  private toWebRequest(request: Request): globalThis.Request {
    const protocol = request.protocol || 'http';
    const host = request.get('host') ?? 'localhost';
    const url = `${protocol}://${host}${request.originalUrl}`;
    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        value.forEach((item) => headers.append(name, item));
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }

    return new globalThis.Request(url, {
      method: request.method,
      headers,
    });
  }
}
