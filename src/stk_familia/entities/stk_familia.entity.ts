import { Column, Entity, OneToMany } from "typeorm";
import { StkItem } from "../../stk-item/entities/stk-item.entity"; // 👈 IMPORTANTE: importás StkItem

@Entity("stk_familia", { schema: "wetech" })
export class StkFamilia {
  @Column("varchar", { primary: true, name: "id", length: 20 })
  id: string;

  @Column("varchar", { name: "descripcion", nullable: true, length: 50 })
  descripcion: string | null;

  @Column("varchar", { name: "version_formula", nullable: true, length: 5 })
  versionFormula: string | null;

  @Column("varchar", { name: "version_receta", nullable: true, length: 5 })
  versionReceta: string | null;

  @Column("varchar", { name: "version_especif", nullable: true, length: 5 })
  versionEspecif: string | null;

  @Column("varchar", { name: "version_proceso", nullable: true, length: 5 })
  versionProceso: string | null;

  @Column("int", { name: "orden", nullable: true })
  orden: number | null;

  /** 🔥 ÚNICA RELACIÓN: Familia -> Items */
  @OneToMany(() => StkItem, (stkItem) => stkItem.familia2)
  stkItems: StkItem[];
}
