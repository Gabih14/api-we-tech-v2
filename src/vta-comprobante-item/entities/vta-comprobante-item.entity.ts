import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
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

  @Column('decimal', { name: 'cantidad', precision: 11, scale: 4 })
  cantidad: number;

  @Column('decimal', { name: 'precio', precision: 14, scale: 4 })
  precio: number;

  @Column('decimal', { name: 'importe', precision: 12, scale: 2 })
  importe: number;

  @Column('decimal', { name: 'ajuste', precision: 5, scale: 2, nullable: true })
  ajuste: number | null;

  @Column('decimal', { name: 'ajuste_neto', precision: 12, scale: 2, nullable: true })
  ajuste_neto: number | null;

  @Column('decimal', { name: 'ajuste_iva', precision: 12, scale: 2, nullable: true })
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
