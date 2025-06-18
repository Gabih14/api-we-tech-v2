import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VtaComprobante } from '../../vta-comprobante/entities/vta-comprobante.entity';
import { StkItem } from '../../stk-item/entities/stk-item.entity';

@Entity('vta_comprobante_item')
export class VtaComprobanteItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precioUnitario: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @ManyToOne(() => VtaComprobante, (comprobante) => comprobante.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comprobante_id' })
  comprobante: VtaComprobante;

  @ManyToOne(() => StkItem, { eager: true })
  @JoinColumn({ name: 'item_id' })
  item: StkItem;
}
