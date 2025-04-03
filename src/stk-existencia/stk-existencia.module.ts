import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkExistenciaService } from './stk-existencia.service';
import { StkExistenciaController } from './stk-existencia.controller';
import { StkExistencia } from './entities/stk-existencia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StkExistencia])],
  controllers: [StkExistenciaController],
  providers: [StkExistenciaService],
  exports: [StkExistenciaService],
})
export class StkExistenciaModule {}
