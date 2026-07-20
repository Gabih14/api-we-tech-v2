import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('pedido_item_config')
export class PedidoItemConfig {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  item: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  controla_serie: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  habilitado_web: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  creado_en: Date;

  @Column({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  actualizado_en: Date;
}
