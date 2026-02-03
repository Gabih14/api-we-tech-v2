import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { VtaCliente } from "../../vta_cliente/entities/vta_cliente.entity";
import { BasMoneda } from "../../bas-moneda/entities/bas-moneda.entity";
//import { FacTrabajador } from "./FacTrabajador";
//import { BasProyecto } from "./BasProyecto";
//import { BasEstado } from "./BasEstado";
//import { SysEmpresa } from "./SysEmpresa";
//import { SysTerminal } from "./SysTerminal";
//import { SysUser } from "./SysUser";
//import { VtaCobroAsiento } from "./VtaCobroAsiento";
import { VtaCobroFactura } from "../../vta-cobro-factura/entities/vta-cobro-factura.entity";
//import { VtaCobroFile } from "./VtaCobroFile";
import { VtaCobroMedio } from "../../vta-cobro-medio/entities/vta-cobro-medio.entity";

@Index("cliente", ["cliente"], {})
@Index("moneda", ["moneda"], {})
@Index("trabajador", ["trabajador"], {})
@Index("proyecto", ["proyecto"], {})
@Index("estado", ["estado"], {})
@Index("empresa", ["empresa"], {})
@Index("terminal", ["terminal"], {})
@Index("user", ["user"], {})
@Entity("vta_cobro", { schema: "wetech" })
export class VtaCobro {
  @Column("varchar", { primary: true, name: "numero", length: 16 })
  numero: string;

  @Column("varchar", { name: "cliente", nullable: true, length: 20 })
  cliente: string | null;

  @Column("datetime", { name: "fecha", nullable: true })
  fecha: Date | null;

  @Column("date", { name: "vencimiento", nullable: true })
  vencimiento: string | null;

  @Column("varchar", { name: "moneda", nullable: true, length: 5 })
  moneda: string | null;

  @Column("decimal", {
    name: "cotizacion",
    nullable: true,
    precision: 10,
    scale: 4,
    default: () => "'1.0000'",
  })
  cotizacion: string | null;

  @Column("varchar", { name: "trabajador", nullable: true, length: 20 })
  trabajador: string | null;

  @Column("decimal", {
    name: "comision",
    nullable: true,
    precision: 6,
    scale: 3,
  })
  comision: string | null;

  @Column("decimal", {
    name: "comision$",
    nullable: true,
    precision: 10,
    scale: 2,
  })

  @Column("tinyint", {
    name: "comisionliq",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  comisionliq: boolean | null;

  @Column("varchar", { name: "proyecto", nullable: true, length: 20 })
  proyecto: string | null;

  @Column("tinyint", {
    name: "anulado",
    nullable: true,
    width: 1,
    default: () => "'0'",
  })
  anulado: boolean | null;

  @Column("text", { name: "observaciones", nullable: true })
  observaciones: string | null;

  @Column("text", { name: "observaciones_int", nullable: true })
  observacionesInt: string | null;

  @Column("decimal", { name: "caja", nullable: true, precision: 12, scale: 2 })
  caja: string | null;

  @Column("decimal", {
    name: "cuenta",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  cuenta: string | null;

  @Column("decimal", {
    name: "tarjeta",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  tarjeta: string | null;

  @Column("decimal", {
    name: "cheque",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  cheque: string | null;

  @Column("decimal", {
    name: "cheque_3ro",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  cheque_3ro: string | null;

  @Column("decimal", {
    name: "certificado",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  certificado: string | null;

  @Column("decimal", {
    name: "ctacte",
    nullable: true,
    precision: 12,
    scale: 2,
  })
  ctacte: string | null;

  @Column("decimal", { name: "total", nullable: true, precision: 14, scale: 2 })
  total: string | null;

  @Column("decimal", {
    name: "subtotal_factura",
    nullable: true,
    precision: 14,
    scale: 2,
  })
  subtotalFactura: string | null;

  @Column("decimal", {
    name: "total_factura",
    nullable: true,
    precision: 14,
    scale: 2,
  })
  totalFactura: string | null;

  @Column("decimal", { name: "ajuste", nullable: true, precision: 5, scale: 2 })
  ajuste: string | null;

  @Column("decimal", {
    name: "ajuste_total",
    nullable: true,
    precision: 14,
    scale: 2,
  })
  ajusteTotal: string | null;

  @Column("decimal", { name: "cargos", nullable: true, precision: 4, scale: 2 })
  cargos: string | null;

  @Column("decimal", {
    name: "cargos$",
    nullable: true,
    precision: 12,
    scale: 2,
  })

  @Column("varchar", { name: "estado", nullable: true, length: 20 })
  estado: string | null;

  @Column("varchar", { name: "empresa", nullable: true, length: 30 })
  empresa: string | null;

  @Column("varchar", { name: "terminal", nullable: true, length: 20 })
  terminal: string | null;

  @Column("varchar", { name: "user", nullable: true, length: 20 })
  user: string | null;

  @Column("bit", { name: "adjuntos", nullable: true, default: () => "'b'0''" })
  adjuntos: boolean | null;

  @Column("bit", { name: "adjuntado", nullable: true, default: () => "'b'0''" })
  adjuntado: boolean | null;

  @Column("bit", { name: "mail", nullable: true, default: () => "'b'0''" })
  mail: boolean | null;

  @Column("bit", { name: "visible", nullable: true, default: () => "'b'1''" })
  visible: boolean | null;

  /* @ManyToOne(() => VtaCliente, (vtaCliente) => vtaCliente.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "cliente", referencedColumnName: "id" }])
  cliente2: VtaCliente; */

 /*  @ManyToOne(() => BasMoneda, (basMoneda) => basMoneda.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "moneda", referencedColumnName: "id" }])
  moneda2: BasMoneda;

  @ManyToOne(() => FacTrabajador, (facTrabajador) => facTrabajador.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "trabajador", referencedColumnName: "id" }])
  trabajador2: FacTrabajador;

  @ManyToOne(() => BasProyecto, (basProyecto) => basProyecto.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "proyecto", referencedColumnName: "id" }])
  proyecto2: BasProyecto;

  @ManyToOne(() => BasEstado, (basEstado) => basEstado.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "estado", referencedColumnName: "id" }])
  estado2: BasEstado;

  @ManyToOne(() => SysEmpresa, (sysEmpresa) => sysEmpresa.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "empresa", referencedColumnName: "id" }])
  empresa2: SysEmpresa;

  @ManyToOne(() => SysTerminal, (sysTerminal) => sysTerminal.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "terminal", referencedColumnName: "id" }])
  terminal2: SysTerminal;

  @ManyToOne(() => SysUser, (sysUser) => sysUser.vtaCobros, {
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "user", referencedColumnName: "uid" }])
  user2: SysUser;

  @OneToMany(() => VtaCobroAsiento, (vtaCobroAsiento) => vtaCobroAsiento.cobro2)
  vtaCobroAsientos: VtaCobroAsiento[];

  @OneToMany(() => VtaCobroFactura, (vtaCobroFactura) => vtaCobroFactura.cobro2)
  vtaCobroFacturas: VtaCobroFactura[];

  @OneToMany(() => VtaCobroFile, (vtaCobroFile) => vtaCobroFile.cobro2)
  vtaCobroFiles: VtaCobroFile[]; */

  @OneToMany(() => VtaCobroMedio, (vtaCobroMedio) => vtaCobroMedio.cobro2)
  vtaCobroMedios: VtaCobroMedio[];

  @OneToMany(
    () => VtaCobroMedio,
    (vtaCobroMedio) => vtaCobroMedio.cobroACuenta2
  )
  vtaCobroMedios2: VtaCobroMedio[];
}
