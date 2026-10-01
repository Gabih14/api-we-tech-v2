import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EcommerceUsuario } from './entities/ecommerce-usuario.entity';
import { MayoristaGuard } from './mayorista.guard';
import { EcommerceUsuariosController } from './ecommerce-usuarios.controller';
import { ClerkService } from '../auth/clerk.service';

@Module({
  imports: [TypeOrmModule.forFeature([EcommerceUsuario], 'back')],
  controllers: [EcommerceUsuariosController],
  providers: [EcommerceUsuariosService, MayoristaGuard, ClerkService],
  exports: [EcommerceUsuariosService, MayoristaGuard, ClerkService],
})
export class EcommerceUsuariosModule {}
