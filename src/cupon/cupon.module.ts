import { Module } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { CuponController } from './cupon.controller';
import { CuponUso } from 'src/cupon_uso/entities/cupon_uso.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cupon } from './entities/cupon.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cupon, CuponUso], 'back')],
  controllers: [CuponController],
  providers: [CuponService],
  exports: [CuponService],
})
export class CuponModule {}
