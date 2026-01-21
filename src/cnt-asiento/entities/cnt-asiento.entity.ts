// src/cnt-asiento/entities/cnt-asiento.entity.ts
import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { bitToBoolTransformer } from 'src/common/transformers/bit-to-bool.transformer';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobanteAsiento } from 'src/vta_comprobante_asiento/entities/vta_comprobante_asiento.entity';

@Entity({ name: 'cnt_asiento' })
export class CntAsiento {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  ejercicio: string;

  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  numero: number;

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

  @Column({ type: 'decimal', precision: 10, scale: 4, default: () => "'1.0000'" })
  cotizacion: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  proyecto: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  empresa: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ejercicio_union: string | null;

  @Column({ type: 'int', nullable: true })
  asiento_union: number | null;

  @Column({ type: 'bit', width: 1, default: () => "b'0'", transformer: bitToBoolTransformer })
  union_asiento: boolean;

  @Column({ type: 'bit', width: 1, default: () => "b'1'", transformer: bitToBoolTransformer })
  visible: boolean;

  @OneToMany(() => CntMovimiento, (m) => m.asientoRef)
  movimientos: CntMovimiento[];

  // ✅ relación con la tabla puente
  @OneToMany(() => VtaComprobanteAsiento, (vca) => vca.asientoRef)
  vtaLinks: VtaComprobanteAsiento[];
}
