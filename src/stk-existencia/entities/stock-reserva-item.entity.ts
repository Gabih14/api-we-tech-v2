import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stock_reserva_item')
@Index(['reservaId', 'item', 'deposito'])
export class StockReservaItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reserva_id', type: 'varchar', length: 36 })
  reservaId: string;

  @Column({ type: 'varchar', length: 20 })
  item: string;

  @Column({ type: 'varchar', length: 20 })
  deposito: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  cantidad: string;
}
