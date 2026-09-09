import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';
import { ColorGroupsController } from './color-groups.controller';
import { ColorGroupsService } from './color-groups.service';
import { ColorGroup } from './entities/color-group.entity';
import { Color } from './entities/color.entity';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkAtributoArbol } from '../stk-item/entities/stk-atributo-arbol.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

@Module({
  imports: [
    // Se conservan las entidades legacy solo porque ColorGroups aun vive en la BD propia.
    TypeOrmModule.forFeature([Color, ColorGroup], 'back'),
    TypeOrmModule.forFeature([
      StkAtributo,
      StkAtributoNodo,
      StkAtributoArbol,
      StkItem,
    ]),
  ],
  controllers: [ColorsController, ColorGroupsController],
  providers: [ColorsService, ColorGroupsService],
  exports: [ColorsService, ColorGroupsService],
})
export class ColorsModule {}
