import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ColorGroup } from './color-group.entity';

@Entity('colors')
export class Color {
  @PrimaryGeneratedColumn()
  id: number;

  /** Referencia logica a stk_atributo, que vive en la conexion del ERP. */
  @Column({
    name: 'stk_atributo_id',
    type: 'varchar',
    length: 10,
    nullable: true,
    unique: true,
  })
  stkAtributoId: string | null;

  /** Solo se leen durante el backfill; los nuevos registros no los usan. */
  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  legacyName: string | null;

  @Column({ name: 'hex', type: 'varchar', length: 7, nullable: true })
  legacyHex: string | null;

  @Column({ name: 'color_group_id', type: 'int', nullable: true })
  colorGroupId: number | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => ColorGroup, (colorGroup) => colorGroup.colors, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'color_group_id' })
  colorGroup: ColorGroup | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
