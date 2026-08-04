import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { VtaComprobante } from '../../vta-comprobante/entities/vta-comprobante.entity';
import { StkItem } from '../../stk-item/entities/stk-item.entity';

@Entity('vta_comprobante_item')
export class VtaComprobanteItem {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  tipo: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  comprobante: string;

  @PrimaryColumn({ type: 'int' })
  linea: number;

  @Column('decimal', {
    name: 'cantidad',
    precision: 13,
    scale: 4,
    nullable: true,
  })
  cantidad: number;

  @Column('decimal', {
    name: 'precio',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  precio: number;

  @Column('tinyint', { name: 'ivainc', nullable: true, width: 1 })
  ivainc: boolean | null;

  @Column('decimal', {
    name: 'alicuota',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  alicuota: number | null;

  @Column('decimal', {
    name: 'importe',
    precision: 17,
    scale: 2,
    nullable: true,
  })
  importe: number;

  @Column('decimal', { name: 'iva', precision: 17, scale: 2, nullable: true })
  iva: number | null;

  @Column('decimal', { name: 'ajuste', precision: 5, scale: 2, nullable: true })
  ajuste: number | null;

  @Column('decimal', {
    name: 'ajuste$',
    precision: 17,
    scale: 2,
    nullable: true,
  })
  ajuste_neto: number | null;

  @Column('decimal', {
    name: 'ajuste$iva',
    precision: 17,
    scale: 2,
    nullable: true,
  })
  ajuste_iva: number | null;

  @ManyToOne(() => VtaComprobante, (comprobante) => comprobante.items)
  @JoinColumn([
    { name: 'tipo', referencedColumnName: 'tipo' },
    { name: 'comprobante', referencedColumnName: 'comprobante' },
  ])
  comprobanteRef: VtaComprobante;

  @ManyToOne(() => StkItem, { eager: true })
  @JoinColumn({ name: 'item', referencedColumnName: 'id' })
  item: StkItem;
}
