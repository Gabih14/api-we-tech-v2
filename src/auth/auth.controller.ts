import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { EcommerceUsuariosService } from '../ecommerce-usuarios/ecommerce-usuarios.service';
import { AuthenticatedRequest } from './authenticated-request';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Controller('auth')
@AuthType('public')
export class AuthController {
  constructor(private readonly ecommerceUsuarios: EcommerceUsuariosService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const userId = request.clerkAuth!.userId;
    const user = await this.ecommerceUsuarios.findOrCreateByClerkUserId(userId);

    return {
      authenticated: true,
      userId,
      customer: {
        id: user.clienteId,
        wholesaleStatus: user.estadoMayorista,
      },
    };
  }
}
