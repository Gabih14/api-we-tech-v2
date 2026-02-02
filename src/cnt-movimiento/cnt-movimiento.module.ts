import { Module } from '@nestjs/common';
import { CntMovimientoService } from './cnt-movimiento.service';
import { CntMovimientoController } from './cnt-movimiento.controller';

@Module({
  controllers: [CntMovimientoController],
  providers: [CntMovimientoService],
})
export class CntMovimientoModule {}
