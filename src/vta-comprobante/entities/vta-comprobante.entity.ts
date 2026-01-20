// src/vta-comprobante/entities/vta-comprobante.entity.ts
import { Entity, Column, PrimaryColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { VtaComprobanteItem } from 'src/vta-comprobante-item/entities/vta-comprobante-item.entity';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';

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

  @Column({ type: 'bit', nullable: true })
  mail: boolean;

  @Column({ type: 'bit', nullable: true })
  visible: boolean;

  @OneToMany(() => VtaComprobanteItem, (item) => item.comprobanteRef, { cascade: true })
  items: VtaComprobanteItem[];

  /**
   * Join table: vta_comprobante_asiento
   * PK en tabla: (tipo, comprobante, ejercicio, asiento)
   * FK hacia cnt_asiento: (ejercicio, asiento)->(ejercicio, id)
   */
  @ManyToMany(() => CntAsiento, (a) => a.vtaComprobantes)
  @JoinTable({
    name: 'vta_comprobante_asiento',
    joinColumns: [
      { name: 'tipo', referencedColumnName: 'tipo' },
      { name: 'comprobante', referencedColumnName: 'comprobante' },
    ],
    inverseJoinColumns: [
      { name: 'ejercicio', referencedColumnName: 'ejercicio' },
      { name: 'asiento', referencedColumnName: 'id' },
    ],
  })
  cntAsientos: CntAsiento[];
}
