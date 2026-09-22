import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PedidoWebLogOrigen = 'lan' | 'remoto';

@Entity('wetech_pedidos_web_acciones_log')
export class PedidoWebAccionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 1 })
  sede_id: number;

  @Column({ type: 'varchar', length: 40 })
  accion: string;

  @Column({ type: 'varchar', length: 100 })
  usuario: string;

  @Column({ type: 'varchar', length: 30 })
  rol: string;

  @Column({ type: 'enum', enum: ['lan', 'remoto'] })
  origen: PedidoWebLogOrigen;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null;

  @Column({ type: 'text', nullable: true })
  detalle: string | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
