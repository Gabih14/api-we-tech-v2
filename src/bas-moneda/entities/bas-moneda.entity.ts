import { Column, Entity, OneToMany } from "typeorm";
import { StkPrecio } from "../../stk-precio/entities/stk-precio.entity";

@Entity("bas_moneda")
export class BasMoneda {
  @Column("varchar", { primary: true, name: "id", length: 5 })
  id: string;

  @Column("varchar", { name: "nombre", nullable: true, length: 25 })
  nombre: string | null;

  @Column("char", { name: "simbolo", nullable: true, length: 3 })
  simbolo: string | null;

  @Column("varchar", { name: "simbolos", nullable: true, length: 20 })
  simbolos: string | null;

  @Column("decimal", {
    name: "cotizacion",
    nullable: true,
    precision: 10,
    scale: 4,
  })
  cotizacion: string | null;

  @Column("varchar", { name: "color", nullable: true, length: 11 })
  color: string | null;

  @Column("blob", { name: "icono", nullable: true })
  icono: Buffer | null;

  @Column("int", { name: "orden", default: () => "'0'" })
  orden: number;

 

  @OneToMany(() => StkPrecio, (stkPrecio) => stkPrecio.moneda)
  stkPrecios: StkPrecio[];

 
}
