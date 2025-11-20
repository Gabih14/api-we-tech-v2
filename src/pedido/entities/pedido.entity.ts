// src/pedido/entities/pedido.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { PedidoItem } from './pedido-item.entity';

@Entity('pedido')
export class Pedido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente_cuit: string;

  @Column()
  cliente_nombre: string;

  @Column()
  external_id: string; // ID de Nave

  @Column()
  total: number;

  @Column({ default: 'PENDIENTE' })
  estado: 'PENDIENTE' | 'APROBADO' | 'CANCELADO';

  @OneToMany(() => PedidoItem, item => item.pedido, { cascade: true })
  productos: PedidoItem[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  creado: Date;

  @Column({ type: 'timestamp', nullable: true })
  aprobado: Date;

  @Column()
  cliente_mail: string;
}
