// src/vta-comprobante/entities/vta-comprobante.entity.ts
import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { VtaComprobanteItem } from 'src/vta-comprobante-item/entities/vta-comprobante-item.entity';
import { VtaComprobanteAsiento } from 'src/vta_comprobante_asiento/entities/vta_comprobante_asiento.entity';
import { bitToBoolTransformer } from 'src/common/transformers/bit-to-bool.transformer';

@Entity({ name: 'vta_comprobante' })
export class VtaComprobante {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  tipo: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  comprobante: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cliente: string;

  @Column({ type: 'datetime', nullable: true })
  fecha: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  periodo: string;

  @Column({ type: 'date', nullable: true })
  vencimiento: Date;

  @Column({ type: 'date', nullable: true })
  fecha_cobro: Date;

  @Column({ type: 'date', nullable: true })
  fecha_entrega: Date;

  @Column({ type: 'date', nullable: true })
  servicio_desde: Date;

  @Column({ type: 'date', nullable: true })
  servicio_hasta: Date;

  @Column({ type: 'varchar', length: 8, nullable: true })
  numero_hasta: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero_aux: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  comprobante_aux: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  comprobante_adj: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  moneda: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cotizacion: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lista: string;

  @Column({ type: 'tinyint', width: 1, nullable: true, transformer: bitToBoolTransformer })
  ivainc: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  alicuota: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ajuste_lista: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ajuste_precio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ajuste_financiero: number;

  @Column({
    type: 'enum',
    enum: ['PORCENTAJE', 'UTILIDAD', 'AJUSTE_GANANCIA', 'AJUSTE_UTILIDAD'],
    nullable: true,
  })
  ajuste_calculo: 'PORCENTAJE' | 'UTILIDAD' | 'AJUSTE_GANANCIA' | 'AJUSTE_UTILIDAD';

  @Column({ type: 'tinyint', width: 1, nullable: true, transformer: bitToBoolTransformer })
  anclar_precio: boolean;

  @Column({
    type: 'enum',
    enum: ['PRODUCTO', 'SERVICIO', 'PRODSERV', 'BIENDEUSO', 'LOCACION'],
    nullable: true,
  })
  concepto: 'PRODUCTO' | 'SERVICIO' | 'PRODSERV' | 'BIENDEUSO' | 'LOCACION';

  @Column({ type: 'varchar', length: 20, nullable: true })
  rubro: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provincia: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  condicion_venta: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  deposito: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sucursal: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  transporte: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  peso: number;

  @Column({ type: 'int', nullable: true })
  cajas: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  trabajador: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  comision: number;

  @Column({ name: 'comision$', type: 'decimal', precision: 10, scale: 2, nullable: true })
  comision$: number;

  @Column({ type: 'tinyint', width: 1, nullable: true, transformer: bitToBoolTransformer })
  comisionliq: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  proyecto: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  existencia_flujo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuota_sistema: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  prorrateo: number;

  @Column({ type: 'tinyint', width: 1, nullable: true, transformer: bitToBoolTransformer })
  anulado: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  tipo_documento: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  numero_documento: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  condicion_iva: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  numero_ib: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  direccion: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  localidad: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  zona: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contacto: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'text', nullable: true })
  observaciones_int: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  neto: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  exento: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  nogravado: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  alicuotas: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  iva: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_1: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_2: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_3: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_4: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_5: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_6: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_7: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_8: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  impuesto_9: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  total: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ajuste: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  ajuste_neto: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  ajuste_iva: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  ganancia: number;

  @Column({ name: 'ganancia$', type: 'decimal', precision: 12, scale: 2, nullable: true })
  ganancia$: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costo_financiero: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  cargos: number;

  @Column({ name: 'cargos$', type: 'decimal', precision: 12, scale: 2, nullable: true })
  cargos$: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  entregado: number;

  @Column({ name: 'entregado$', type: 'decimal', precision: 14, scale: 2, nullable: true })
  entregado$: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  cobrado: number;

  @Column({ type: 'varchar', length: 14, nullable: true })
  cae: string;

  @Column({ type: 'date', nullable: true })
  vto_cae: Date;

  @Column({ type: 'enum', enum: ['APROBADO', 'RECHAZADO', 'PARCIAL'], nullable: true })
  resultado: 'APROBADO' | 'RECHAZADO' | 'PARCIAL';

  @Column({ type: 'varchar', length: 20, nullable: true })
  estado: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  empresa: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  terminal: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  user: string;

  @Column({ type: 'bit', width: 1, nullable: true, transformer: bitToBoolTransformer })
  adjuntos: boolean;

  @Column({ type: 'bit', width: 1, nullable: true, transformer: bitToBoolTransformer })
  adjuntado: boolean;

  @Column({ type: 'bit', width: 1, nullable: true, transformer: bitToBoolTransformer })
  mail: boolean;

  @Column({ type: 'bit', width: 1, nullable: true, transformer: bitToBoolTransformer })
  visible: boolean;

  @OneToMany(() => VtaComprobanteItem, (item) => item.comprobanteRef, { cascade: true })
  items: VtaComprobanteItem[];

  // ✅ Link a asientos contables (tabla puente)
  @OneToMany(() => VtaComprobanteAsiento, (vca) => vca.comprobanteRef)
  asientosLink: VtaComprobanteAsiento[];
}
