import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkItem } from './entities/stk-item.entity';
import { StkFamilia } from '../stk_familia/entities/stk_familia.entity'; // 👈 importamos StkFamilia
import { StkItemService } from './stk-item.service';
import { StkItemController } from './stk-item.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StkItem, StkFamilia])], // 👈 también la agregamos acá
  providers: [StkItemService],
  controllers: [StkItemController],
  exports: [StkItemService],
})
export class StkItemModule {}
