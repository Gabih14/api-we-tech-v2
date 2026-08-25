import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bitToBoolTransformer } from '../../common/transformers/bit-to-bool.transformer';

@Entity('delivery_config')
export class DeliveryConfig {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @Column({ name: 'api_key', type: 'varchar', length: 255, nullable: true })
  api_key: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @UpdateDateColumn({
    name: 'actualizado_en',
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  actualizado_en: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  item: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provincia: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  departamento: string | null;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  kms: number | null;

  @Column({
    type: 'bit',
    width: 1,
    default: () => "b'1'",
    transformer: bitToBoolTransformer,
  })
  activo: boolean;
}
