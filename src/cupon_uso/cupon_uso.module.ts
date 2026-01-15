import { Module } from '@nestjs/common';
import { CuponUsoService } from './cupon_uso.service';
import { CuponUsoController } from './cupon_uso.controller';

@Module({
  controllers: [CuponUsoController],
  providers: [CuponUsoService],
})
export class CuponUsoModule {}
