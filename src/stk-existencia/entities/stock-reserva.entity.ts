import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StockReservaEstado = 'RESERVADA' | 'CONFIRMADA' | 'LIBERADA';

@Entity('stock_reserva')
export class StockReserva {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ name: 'external_id', type: 'varchar', length: 32 })
  externalId: string;

  @Column({ type: 'enum', enum: ['RESERVADA', 'CONFIRMADA', 'LIBERADA'] })
  estado: StockReservaEstado;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'creado', type: 'timestamp' })
  creado: Date;

  @UpdateDateColumn({ name: 'actualizado', type: 'datetime', nullable: true })
  actualizado: Date | null;
}
