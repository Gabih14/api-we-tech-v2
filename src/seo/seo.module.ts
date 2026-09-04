import { Module } from '@nestjs/common';
import { StkItemModule } from '../stk-item/stk-item.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [StkItemModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
