import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoArbol } from '../stk-item/entities/stk-atributo-arbol.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { AdminTaxonomiaController } from './admin-taxonomia.controller';
import { AdminTaxonomiaService } from './admin-taxonomia.service';
import { AsignacionesService } from './asignaciones.service';
import { AtributosEfectivosService } from './atributos-efectivos.service';
import { AuditoriaService } from './auditoria.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StkItem,
      StkAtributo,
      StkAtributoNodo,
      StkAtributoArbol,
    ]),
  ],
  controllers: [AdminTaxonomiaController],
  providers: [
    AdminTaxonomiaService,
    AtributosEfectivosService,
    AsignacionesService,
    AuditoriaService,
  ],
})
export class AdminTaxonomiaModule {}
