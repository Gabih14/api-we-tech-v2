import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { VtaCobro } from "../../vta-cobro/entities/vta-cobro.entity";
import { VtaComprobante } from "../../vta-comprobante/entities/vta-comprobante.entity";

@Index("tipo", ["tipo", "factura"], {})
@Entity("vta_cobro_factura", { schema: "wetech" })
export class VtaCobroFactura {
  @Column("varchar", { primary: true, name: "cobro", length: 16 })
  cobro: string;

  @Column("varchar", { primary: true, name: "tipo", length: 4 })
  tipo: string;

  @Column("varchar", { primary: true, name: "factura", length: 16 })
  factura: string;

  @Column("int", { name: "linea", nullable: true })
  linea: number | null;

  @Column("decimal", {
    name: "importe",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  importe: string | null;

  @Column("decimal", {
    name: "cotizacion",
    nullable: true,
    precision: 10,
    scale: 4,
  })
  cotizacion: string | null;

  @Column("decimal", { name: "ajuste", nullable: true, precision: 5, scale: 2 })
  ajuste: string | null;

  @Column("decimal", {
    name: "ajuste_importe",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  ajusteImporte: string | null;

  @Column("tinyint", {
    name: "ajusteximp",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  ajusteximp: boolean | null;

 /*  @ManyToOne(() => VtaCobro, (vtaCobro) => vtaCobro.vtaCobroFacturas, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cobro", referencedColumnName: "numero" }])
  cobro2: VtaCobro;

  @ManyToOne(
    () => VtaComprobante,
    (vtaComprobante) => vtaComprobante.vtaCobroFacturas,
    { onDelete: "CASCADE", onUpdate: "CASCADE" }
    ) 
  @JoinColumn([
    { name: "tipo", referencedColumnName: "tipo" },
    { name: "factura", referencedColumnName: "comprobante" },
  ])
    */
  vtaComprobante: VtaComprobante;
}
