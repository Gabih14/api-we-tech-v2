import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { StkItem } from "../../stk-item/entities/stk-item.entity";
import { BasMoneda } from "../../bas-moneda/entities/bas-moneda.entity";

@Index("item", ["item"], {})
@Index("moneda", ["moneda"], {})
@Entity("stk_precio")
export class StkPrecio {
  @Column("varchar", { primary: true, name: "lista", length: 20 })
  lista: string;

  @Column("varchar", { primary: true, name: "item", length: 20 })
  item: string;

  @Column("decimal", {
    name: "precio",
    nullable: true,
    precision: 14,
    scale: 4,
    default: () => "'0.0000'",
  })
  precio: string | null;

  @Column("decimal", {
    name: "precio_vta",
    nullable: true,
    precision: 14,
    scale: 4,
  })
  precioVta: string | null;

  @Column("decimal", {
    name: "precio_aux",
    nullable: true,
    precision: 14,
    scale: 4,
  })
  precioAux: string | null;

  @Column("decimal", {
    name: "ganancia",
    nullable: true,
    precision: 6,
    scale: 2,
  })
  ganancia: string | null;

  @Column("decimal", {
    name: "utilidad",
    nullable: true,
    precision: 6,
    scale: 2,
  })
  utilidad: string | null;

  @Column("tinyint", { name: "ivainc", nullable: true, width: 1 })
  ivainc: boolean | null;

  @Column("decimal", {
    name: "alicuota",
    nullable: true,
    precision: 5,
    scale: 2,
  })
  alicuota: string | null;

  @Column("date", { name: "fecha", nullable: true })
  fecha: string | null;

  // Relación con StkItem
  @ManyToOne(() => StkItem, (stkItem) => stkItem.stkPrecios, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "item", referencedColumnName: "id" }])
  item2: StkItem;

  // Relación con BasMoneda
  @ManyToOne(() => BasMoneda, (basMoneda) => basMoneda.stkPrecios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "moneda", referencedColumnName: "id" }])
  moneda: BasMoneda;
}
