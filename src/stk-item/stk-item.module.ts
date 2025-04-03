import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkItem } from './entities/stk-item.entity';
import { StkItemService } from './stk-item.service';
import { StkItemController } from './stk-item.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StkItem])],
  providers: [StkItemService],
  controllers: [StkItemController],
  exports: [StkItemService],
})
export class StkItemModule {}
