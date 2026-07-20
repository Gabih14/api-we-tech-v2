import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pedido } from './pedido.entity';
import { PedidoItem } from './pedido-item.entity';

export enum PedidoItemSerieEstado {
  RESERVADA = 'RESERVADA',
  CONFIRMANDO = 'CONFIRMANDO',
  CONFIRMADA = 'CONFIRMADA',
  LIBERADA = 'LIBERADA',
  CANCELADA = 'CANCELADA',
  ERROR = 'ERROR',
}

@Entity('pedido_item_serie')
export class PedidoItemSerie {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'int' })
  pedido_id: number;

  @Column({ type: 'int' })
  pedido_item_id: number;

  @Column({ type: 'varchar', length: 20 })
  item: string;

  @Column({ type: 'varchar', length: 40 })
  serie: string;

  @Column({ type: 'enum', enum: PedidoItemSerieEstado })
  estado: PedidoItemSerieEstado;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  reservada_en: Date;

  @Column({ type: 'datetime', nullable: true })
  expira_en: Date | null;

  @Column({ type: 'datetime', nullable: true })
  confirmada_en: Date | null;

  @Column({ type: 'datetime', nullable: true })
  liberada_en: Date | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  comprobante_tipo: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  comprobante: string | null;

  @Column({ type: 'int', nullable: true })
  comprobante_linea: number | null;

  @Column({ type: 'text', nullable: true })
  error_detalle: string | null;

  @ManyToOne(() => Pedido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @ManyToOne(() => PedidoItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_item_id' })
  pedidoItem: PedidoItem;
}
