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

  @Column({ type: 'varchar', length: 100, nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  tipo_documento: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  numero_documento: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  nogravado: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  total: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  cobrado: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estado: string;

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
