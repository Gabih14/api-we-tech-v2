import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkDeposito } from './entities/stk-deposito.entity';
import { StkDepositoService } from './stk-deposito.service';
import { StkDepositoController } from './stk-deposito.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StkDeposito])],
  controllers: [StkDepositoController],
  providers: [StkDepositoService],
})
export class StkDepositoModule {}
