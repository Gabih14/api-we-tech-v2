import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { MayoristaGuard } from './mayorista.guard';

@Controller('mayorista')
@AuthType('public')
export class MayoristaController {
  @Get('status')
  @UseGuards(ClerkAuthGuard, MayoristaGuard)
  status(@Req() request: AuthenticatedRequest) {
    return {
      authorized: true,
      wholesaleStatus: request.ecommerceUsuario!.estadoMayorista,
    };
  }
}
