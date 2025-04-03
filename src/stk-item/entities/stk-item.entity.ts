import {
    Column,
    Entity,
    Index,
    OneToMany,
} from "typeorm";

import { StkExistencia } from "../../stk-existencia/entities/stk-existencia.entity";
import { StkPrecio } from "../../stk-precio/entities/stk-precio.entity";

@Index("grupo", ["grupo"], {})
@Index("subgrupo", ["subgrupo"], {})
/* @Index("familia", ["familia"], {}) */
@Entity("stk_item", { schema: "wetech" })
export class StkItem {
    @Column("varchar", { primary: true, name: "id", length: 20 })
    id: string;

    @Column("varchar", { name: "descripcion", nullable: true, length: 2048 })
    descripcion: string | null;

    @Column("varchar", { name: "presentacion", nullable: true, length: 100 })
    presentacion: string | null;

    @Column("enum", {
        name: "tipo",
        nullable: true,
        enum: ["PT", "SE", "MP", "CP", "BU", "S", "C"],
    })
    tipo: "PT" | "SE" | "MP" | "CP" | "BU" | "S" | "C" | null;

    @Column("varchar", { name: "grupo", nullable: true, length: 50 })
    grupo: string | null;

    @Column("varchar", { name: "subgrupo", nullable: true, length: 50 })
    subgrupo: string | null;

    @OneToMany(() => StkExistencia, (stkExistencia) => stkExistencia.item2)
    stkExistencias: StkExistencia[];

    @OneToMany(() => StkPrecio, (stkPrecio) => stkPrecio.item2)
    stkPrecios: StkPrecio[];
  
}

