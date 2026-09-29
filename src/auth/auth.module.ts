import { Module } from '@nestjs/common';
import { EcommerceUsuariosModule } from '../ecommerce-usuarios/ecommerce-usuarios.module';
import { AuthController } from './auth.controller';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';
import { MayoristaController } from '../ecommerce-usuarios/mayorista.controller';

@Module({
  imports: [EcommerceUsuariosModule],
  controllers: [AuthController, MayoristaController],
  providers: [ClerkService, ClerkAuthGuard],
  exports: [ClerkAuthGuard],
})
export class AuthModule {}
