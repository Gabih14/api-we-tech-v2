import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkExistencia } from '../stk-existencia/entities/stk-existencia.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { DmEspera } from './entities/dm-espera.entity';
import { EsperaController } from './espera.controller';
import { EsperaService } from './espera.service';

@Module({
  imports: [TypeOrmModule.forFeature([DmEspera, StkItem, StkExistencia])],
  controllers: [EsperaController],
  providers: [EsperaService],
  exports: [EsperaService],
})
export class EsperaModule {}
