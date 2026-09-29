import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EcommerceUsuario } from './entities/ecommerce-usuario.entity';
import { MayoristaGuard } from './mayorista.guard';
import { EcommerceUsuariosController } from './ecommerce-usuarios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EcommerceUsuario], 'back')],
  controllers: [EcommerceUsuariosController],
  providers: [EcommerceUsuariosService, MayoristaGuard],
  exports: [EcommerceUsuariosService, MayoristaGuard],
})
export class EcommerceUsuariosModule {}
