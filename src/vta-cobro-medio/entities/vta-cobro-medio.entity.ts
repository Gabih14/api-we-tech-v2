import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { VtaCobro } from "../../vta-cobro/entities/vta-cobro.entity";
//import { FndCaja } from "./FndCaja";
//import { FndCuenta } from "./FndCuenta";
//import { FndTarjeta } from "./FndTarjeta";
//import { FndCheque } from "./FndCheque";
//import { FndCheque_3ro } from "./FndCheque_3ro";
//import { VtaCertificado } from "./VtaCertificado";

@Index("cliente", ["cliente", "certificado"], {})
@Index("moneda", ["moneda"], {})
@Index("caja", ["caja"], {})
@Index("cuenta", ["cuenta"], {})
@Index("tarjeta", ["tarjeta"], {})
@Index("cheque", ["cheque"], {})
@Index("cheque3ro", ["cheque_3ro"], {})
@Index("certificado", ["certificado", "cliente"], {})
@Index("cobroacuenta", ["cobroACuenta"], {})
@Entity("vta_cobro_modo", { schema: "wetech" })
export class VtaCobroMedio {
  @Column("varchar", { primary: true, name: "cobro", length: 16 })
  cobro: string;

  @Column("int", { primary: true, name: "linea", default: () => "'0'" })
  linea: number;

  @Column("decimal", {
    name: "importe",
    nullable: true,
    precision: 17,
    scale: 2,
  })
  importe: string | null;

  @Column("varchar", { name: "moneda", nullable: true, length: 5 })
  moneda: string | null;

  @Column("decimal", {
    name: "cotizacion",
    nullable: true,
    precision: 10,
    scale: 4,
  })
  cotizacion: string | null;

  @Column("enum", {
    name: "modo",
    nullable: true,
    enum: [
      "CAJA",
      "CUENTA",
      "TARJETA",
      "CHEQUE",
      "CHEQUE3RO",
      "CERTIFICADO",
      "CTACTE",
    ],
  })
  modalidad:
    | "CAJA"
    | "CUENTA"
    | "TARJETA"
    | "CHEQUE"
    | "CHEQUE3RO"
    | "CERTIFICADO"
    | "CTACTE"
    | null;

  @Column("varchar", { name: "caja", nullable: true, length: 20 })
  caja: string | null;

  @Column("varchar", { name: "cuenta", nullable: true, length: 20 })
  cuenta: string | null;

  @Column("varchar", { name: "tarjeta", nullable: true, length: 20 })
  tarjeta: string | null;

  @Column("varchar", { name: "cheque", nullable: true, length: 16 })
  cheque: string | null;

  @Column("varchar", { name: "cheque3ro", nullable: true, length: 16 })
  cheque_3ro: string | null;

  @Column("varchar", { name: "certificado", nullable: true, length: 20 })
  certificado: string | null;

  @Column("varchar", { name: "cliente", nullable: true, length: 20 })
  cliente: string | null;

  @Column("varchar", { name: "cobroacuenta", nullable: true, length: 16 })
  cobroACuenta: string | null;

  @Column("varchar", { name: "leyenda", nullable: true, length: 128 })
  detalle: string | null;

  @Column("date", { name: "imputacion", nullable: true })
  imputacion: string | null;

  @Column("tinyint", {
    name: "conciliado",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  conciliado: boolean | null;

  @Column("tinyint", {
    name: "anulado",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  anulado: boolean | null;

  @ManyToOne(() => VtaCobro, (vtaCobro) => vtaCobro.vtaCobroMedios, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cobro", referencedColumnName: "numero" }])
  cobro2: VtaCobro;

  /* @ManyToOne(() => BasMoneda, (basMoneda) => basMoneda.vtaCobroMedios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "moneda", referencedColumnName: "id" }])
  moneda2: BasMoneda;

  @ManyToOne(() => FndCaja, (fndCaja) => fndCaja.vtaCobroMedios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "caja", referencedColumnName: "id" }])
  caja2: FndCaja;

  @ManyToOne(() => FndCuenta, (fndCuenta) => fndCuenta.vtaCobroMedios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cuenta", referencedColumnName: "id" }])
  cuenta2: FndCuenta;

  @ManyToOne(() => FndTarjeta, (fndTarjeta) => fndTarjeta.vtaCobroMedios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "tarjeta", referencedColumnName: "id" }])
  tarjeta2: FndTarjeta;

  @ManyToOne(() => FndCheque, (fndCheque) => fndCheque.vtaCobroMedios, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cheque", referencedColumnName: "numero" }])
  cheque2: FndCheque;

  @ManyToOne(
    () => FndCheque_3ro,
    (fndCheque_3ro) => fndCheque_3ro.vtaCobroMedios,
    { onDelete: "SET NULL", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "cheque3ro", referencedColumnName: "numero" }])
  cheque_3ro2: FndCheque_3ro;

  @ManyToOne(
    () => VtaCertificado,
    (vtaCertificado) => vtaCertificado.vtaCobroMedios,
    { onDelete: "SET NULL", onUpdate: "CASCADE" }
  )
  @JoinColumn([
    { name: "certificado", referencedColumnName: "numero" },
    { name: "cliente", referencedColumnName: "cliente" },
  ])
  vtaCertificado: VtaCertificado; */

  @ManyToOne(() => VtaCobro, (vtaCobro) => vtaCobro.vtaCobroMedios2, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cobroacuenta", referencedColumnName: "numero" }])
  cobroACuenta2: VtaCobro;
}
