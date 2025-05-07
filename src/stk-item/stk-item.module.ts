import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkItem } from './entities/stk-item.entity';
import { StkFamilia } from '../stk_familia/entities/stk_familia.entity'; 
import { StkItemService } from './stk-item.service';
import { StkItemController } from './stk-item.controller';
import { StkPrecioModule } from 'src/stk-precio/stk-precio.module';

@Module({
  imports: [TypeOrmModule.forFeature([StkItem, StkFamilia]), StkPrecioModule], 
  providers: [StkItemService],
  controllers: [StkItemController],
  exports: [StkItemService],
})
export class StkItemModule {}
