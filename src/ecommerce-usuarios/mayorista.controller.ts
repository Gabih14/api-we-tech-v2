import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { MayoristaGuard } from './mayorista.guard';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { SolicitarMayoristaDto } from './dto/solicitar-mayorista.dto';

@Controller('mayorista')
@AuthType('public')
export class MayoristaController {
  constructor(private readonly ecommerceUsuarios: EcommerceUsuariosService) {}

  @Post('solicitud')
  @UseGuards(ClerkAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async solicitar(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SolicitarMayoristaDto,
  ) {
    const user = await this.ecommerceUsuarios.solicitarMayorista(
      request.clerkAuth!.userId,
      dto,
    );

    return { wholesaleStatus: user.estadoMayorista };
  }

  @Get('status')
  @UseGuards(ClerkAuthGuard, MayoristaGuard)
  status(@Req() request: AuthenticatedRequest) {
    return {
      authorized: true,
      wholesaleStatus: request.ecommerceUsuario!.estadoMayorista,
    };
  }
}
