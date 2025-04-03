import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { StkItem } from "../../stk-item/entities/stk-item.entity";
import { StkDeposito } from "../../stk-deposito/entities/stk-deposito.entity"; 

@Index("deposito", ["deposito"], {})
@Entity("stk_existencia", { schema: "wetech" })
export class StkExistencia {
  @Column("varchar", { primary: true, name: "item", length: 20 })
  item: string;

  @Column("varchar", { primary: true, name: "deposito", length: 20 })
  deposito: string;

  @Column("decimal", {
    name: "cantidad",
    nullable: true,
    precision: 14,
    scale: 4,
    default: () => "'0.0000'",
  })
  cantidad: string | null;

  @Column("decimal", {
    name: "produccion",
    nullable: true,
    precision: 14,
    scale: 4,
    default: () => "'0.0000'",
  })
  produccion: string | null;

  @Column("decimal", {
    name: "comprometido",
    nullable: true,
    precision: 14,
    scale: 4,
    default: () => "'0.0000'",
  })
  comprometido: string | null;

  @Column("varchar", { name: "ubicacion", nullable: true, length: 20 })
  ubicacion: string | null;

  @ManyToOne(() => StkItem, (stkItem) => stkItem.stkExistencias, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "item", referencedColumnName: "id" }])
  item2: StkItem;

  @ManyToOne(() => StkDeposito, (stkDeposito) => stkDeposito.stkExistencias, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "deposito", referencedColumnName: "id" }])
  deposito2: StkDeposito;
}
