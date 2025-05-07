import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkPrecio } from './entities/stk-precio.entity';
import { StkPrecioService } from './stk-precio.service';
import { StkPrecioController } from './stk-precio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StkPrecio])],
  controllers: [StkPrecioController],
  providers: [StkPrecioService],
  exports: [StkPrecioService]
})
export class StkPrecioModule {}