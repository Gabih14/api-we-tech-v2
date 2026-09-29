import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EstadoMayorista } from './entities/ecommerce-usuario.entity';

@Injectable()
export class MayoristaGuard implements CanActivate {
  constructor(private readonly ecommerceUsuarios: EcommerceUsuariosService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = request.clerkAuth?.userId;

    if (!clerkUserId) {
      throw new UnauthorizedException('Se requiere autenticacion Clerk');
    }

    const user = await this.ecommerceUsuarios.findByClerkUserId(clerkUserId);
    if (!user || user.estadoMayorista !== EstadoMayorista.APROBADO) {
      throw new ForbiddenException('Acceso mayorista no aprobado');
    }

    request.ecommerceUsuario = user;
    return true;
  }
}
