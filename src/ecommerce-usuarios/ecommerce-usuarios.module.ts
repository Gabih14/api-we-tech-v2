import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EcommerceUsuario } from './entities/ecommerce-usuario.entity';
import { MayoristaGuard } from './mayorista.guard';

@Module({
  imports: [TypeOrmModule.forFeature([EcommerceUsuario], 'back')],
  providers: [EcommerceUsuariosService, MayoristaGuard],
  exports: [EcommerceUsuariosService, MayoristaGuard],
})
export class EcommerceUsuariosModule {}
