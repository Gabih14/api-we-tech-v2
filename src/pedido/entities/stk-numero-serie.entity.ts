import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('stk_numero_serie')
export class StkNumeroSerie {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  item: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  serie: string;

  @Column({ type: 'date', nullable: true })
  ingreso: string | null;

  @Column({ type: 'date', nullable: true })
  egreso: string | null;
}
