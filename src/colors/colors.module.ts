import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';
import { ColorGroupsController } from './color-groups.controller';
import { ColorGroupsService } from './color-groups.service';
import { ColorGroup } from './entities/color-group.entity';
import { Color } from './entities/color.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Color, ColorGroup], 'back')],
  controllers: [ColorsController, ColorGroupsController],
  providers: [ColorsService, ColorGroupsService],
  exports: [ColorsService, ColorGroupsService],
})
export class ColorsModule {}
