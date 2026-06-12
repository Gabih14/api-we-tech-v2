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

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  hex: string;

  @Column({ name: 'color_group_id', type: 'int', nullable: true })
  colorGroupId: number | null;

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
