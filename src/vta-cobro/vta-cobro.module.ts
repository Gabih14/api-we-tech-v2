import { Module } from '@nestjs/common';
import { VtaCobroService } from './vta-cobro.service';
import { VtaCobroController } from './vta-cobro.controller';

@Module({
  controllers: [VtaCobroController],
  providers: [VtaCobroService],
})
export class VtaCobroModule {}
