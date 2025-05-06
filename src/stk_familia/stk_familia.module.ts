import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkFamilia } from './entities/stk_familia.entity';
import { StkFamiliaService } from './stk_familia.service';
import { StkFamiliaController } from './stk_familia.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StkFamilia])],
  controllers: [StkFamiliaController],
  providers: [StkFamiliaService],
})
export class StkFamiliaModule {}
