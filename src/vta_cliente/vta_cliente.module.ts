import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtaClienteService } from './vta_cliente.service';
import { VtaClienteController } from './vta_cliente.controller';
import { ClienteDireccionLink } from './entities/cliente-direccion-link.entity';
import { VtaCliente } from './entities/vta_cliente.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VtaCliente]),
    TypeOrmModule.forFeature([ClienteDireccionLink], 'back'),
  ],
  controllers: [VtaClienteController],
  providers: [VtaClienteService],
  exports: [VtaClienteService],
})
export class VtaClienteModule {}
