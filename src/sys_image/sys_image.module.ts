import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysImage } from './entities/sys_image.entity';
import { SysImageService } from './sys_image.service';
import { SysImageController } from './sys_image.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SysImage])],
  controllers: [SysImageController],
  providers: [SysImageService],
})
export class SysImageModule {}
