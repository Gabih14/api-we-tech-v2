import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoController } from './stk-atributo.controller';
import { StkAtributoService } from './stk-atributo.service';

@Module({
  imports: [TypeOrmModule.forFeature([StkAtributo])],
  controllers: [StkAtributoController],
  providers: [StkAtributoService],
})
export class StkAtributoModule {}
