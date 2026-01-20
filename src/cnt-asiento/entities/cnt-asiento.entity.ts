// src/cnt-asiento/entities/cnt-asiento.entity.ts
import { Entity, Column, PrimaryColumn, OneToMany, ManyToMany } from 'typeorm';
import { bitToBoolTransformer } from 'src/common/transformers/bit-to-bool.transformer';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobante } from 'src/vta-comprobante/entities/vta-comprobante.entity';

@Entity({ name: 'cnt_asiento' })
export class CntAsiento {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  ejercicio: string;

  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  numero: number;

  // en DB es DATE (no datetime)
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'date', nullable: true })
  imputacion: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  leyenda: string | null;

  @Column({ type: 'decimal', precision: 17, scale: 2, nullable: true })
  saldo_debe: string | null;

  @Column({ type: 'decimal', precision: 17, scale: 2, nullable: true })
  saldo_haber: string | null;

  @Column({
    type: 'enum',
    enum: ['APERTURA', 'OPERATIVO', 'AJUSTE', 'REGULARIZACION', 'CIERRE', 'AUTO', 'MANUAL'],
    nullable: true,
  })
  tipo:
    | 'APERTURA'
    | 'OPERATIVO'
    | 'AJUSTE'
    | 'REGULARIZACION'
    | 'CIERRE'
    | 'AUTO'
    | 'MANUAL'
    | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  moneda: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: () => "'1.0000'",
  })
  cotizacion: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  proyecto: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  empresa: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ejercicio_union: string | null;

  @Column({ type: 'int', nullable: true })
  asiento_union: number | null;

  @Column({
    type: 'bit',
    width: 1,
    default: () => "b'0'",
    transformer: bitToBoolTransformer,
  })
  union_asiento: boolean;

  @Column({
    type: 'bit',
    width: 1,
    default: () => "b'1'",
    transformer: bitToBoolTransformer,
  })
  visible: boolean;

  // FK: cnt_movimiento (ejercicio, asiento) -> cnt_asiento (ejercicio, id)
  @OneToMany(() => CntMovimiento, (m) => m.asientoRef)
  movimientos: CntMovimiento[];

  /**
   * Relación inversa del JoinTable "vta_comprobante_asiento".
   * El JoinTable está definido del lado de VtaComprobante (como en tu export).
   */
  @ManyToMany(() => VtaComprobante, (vc) => vc.cntAsientos)
  vtaComprobantes: VtaComprobante[];
}
