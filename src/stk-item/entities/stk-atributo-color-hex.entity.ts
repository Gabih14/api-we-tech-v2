import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StkAtributo } from './stk-atributo.entity';

@Entity('stk_atributo_color_hex')
export class StkAtributoColorHex {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { name: 'atributo_id', length: 10 })
  atributoId: string;

  @Column('varchar', { name: 'hex', length: 11 })
  hex: string;

  @Column('int', { name: 'orden' })
  orden: number;

  @ManyToOne(() => StkAtributo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'atributo_id' })
  atributo: StkAtributo;
}
