import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkFamilia } from './entities/stk_familia.entity';
import { StkFamiliaService } from './stk_familia.service';
import { StkFamiliaController } from './stk_familia.controller';
import { StkPrecioModule } from 'src/stk-precio/stk-precio.module';

@Module({
  imports: [TypeOrmModule.forFeature([StkFamilia]), StkPrecioModule],
  controllers: [StkFamiliaController],
  providers: [StkFamiliaService],
})
export class StkFamiliaModule {}
