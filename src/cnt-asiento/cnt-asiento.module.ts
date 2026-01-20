import { Module } from '@nestjs/common';
import { CntAsientoService } from './cnt-asiento.service';
import { CntAsientoController } from './cnt-asiento.controller';
import { CntAsiento } from './entities/cnt-asiento.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CntAsiento, CntMovimiento])],
  controllers: [CntAsientoController],
  providers: [CntAsientoService],
  exports:[TypeOrmModule]
})
export class CntAsientoModule {}
