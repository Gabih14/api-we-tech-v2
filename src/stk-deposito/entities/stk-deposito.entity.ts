import { Column, Entity, OneToMany } from "typeorm";
import { StkExistencia } from "../../stk-existencia/entities/stk-existencia.entity";

@Entity("stk_deposito")
export class StkDeposito {
  @Column("varchar", { primary: true, name: "id", length: 20 })
  id: string;

  @Column("varchar", { name: "descripcion", nullable: true, length: 50 })
  descripcion: string | null;

  @Column("varchar", { name: "direccion", nullable: true, length: 50 })
  direccion: string | null;

  @Column("tinyint", {
    name: "existencia_lote",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  existenciaLote: boolean | null;

  @Column("varchar", { name: "lote_existencia", nullable: true, length: 11 })
  loteExistencia: string | null;

  @Column("int", { name: "orden", nullable: true })
  orden: number | null;

  @OneToMany(() => StkExistencia, (stkExistencia) => stkExistencia.deposito2)
  stkExistencias: StkExistencia[];
}
