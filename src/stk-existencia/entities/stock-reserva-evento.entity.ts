import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('stock_reserva_evento')
@Index(['reservaId', 'creado'])
export class StockReservaEvento {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'reserva_id', type: 'varchar', length: 36 })
  reservaId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'creado', type: 'timestamp' })
  creado: Date;
}
