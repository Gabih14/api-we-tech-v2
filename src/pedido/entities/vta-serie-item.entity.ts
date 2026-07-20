import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('vta_serie_item')
export class VtaSerieItem {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  tipo: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  comprobante: string;

  @PrimaryColumn({ type: 'int' })
  linea: number;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  item: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  serie: string;
}
