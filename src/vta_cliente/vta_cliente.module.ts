import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VtaClienteService } from './vta_cliente.service';
import { VtaClienteController } from './vta_cliente.controller';
import { VtaCliente } from './entities/vta_cliente.entity'; // 👈 Importá la entidad

@Module({
  imports: [TypeOrmModule.forFeature([VtaCliente])], // 👈 IMPORTANTE
  controllers: [VtaClienteController],
  providers: [VtaClienteService],
  exports: [VtaClienteService], // opcional si lo vas a usar desde otros módulos
})
export class VtaClienteModule {}
