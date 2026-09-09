import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DeliveryConfig } from './delivery-config.entity';

@Entity('delivery_config_departamento')
@Unique('uq_delivery_config_departamento', [
  'delivery_config_id',
  'departamento',
])
export class DeliveryConfigDepartamento {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int' })
  delivery_config_id: number;

  @Column({ type: 'varchar', length: 100 })
  departamento: string;

  @ManyToOne(() => DeliveryConfig, (config) => config.departamentos, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'delivery_config_id' })
  deliveryConfig: DeliveryConfig;
}
