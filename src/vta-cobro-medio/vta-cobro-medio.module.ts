import { Module } from '@nestjs/common';
import { VtaCobroMedioService } from './vta-cobro-medio.service';
import { VtaCobroMedioController } from './vta-cobro-medio.controller';

@Module({
  controllers: [VtaCobroMedioController],
  providers: [VtaCobroMedioService],
})
export class VtaCobroMedioModule {}
