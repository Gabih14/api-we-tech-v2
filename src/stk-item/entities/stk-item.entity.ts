import {
  Column,
  Entity,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { StkExistencia } from "../../stk-existencia/entities/stk-existencia.entity";
import { StkPrecio } from "../../stk-precio/entities/stk-precio.entity";
import { StkFamilia } from "../../stk_familia/entities/stk_familia.entity";

@Index("grupo", ["grupo"], {})
@Index("subgrupo", ["subgrupo"], {})
@Entity("stk_item")
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

  /** 🔥 Clave foránea real en la DB: "familia" (no "familia_id") */
  @Column("varchar", { name: "familia", nullable: true, length: 20 })
  familia: string | null;

  @ManyToOne(() => StkFamilia, (stkFamilia) => stkFamilia.stkItems, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "familia", referencedColumnName: "id" }])
  familia2: StkFamilia;

  @OneToMany(() => StkExistencia, (stkExistencia) => stkExistencia.item2)
  stkExistencias: StkExistencia[];

  @OneToMany(() => StkPrecio, (stkPrecio) => stkPrecio.item2)
  stkPrecios: StkPrecio[];

@Column({
  type: 'bit',
  width: 1,
  nullable: true,
  transformer: {
    to: (value: boolean) => (value ? 1 : 0),
    from: (value: Buffer) => value?.[0] === 1,
  },
})
visible: boolean;


  @Column("blob", { name: "foto", nullable: true })
  foto: Buffer | null;

}
