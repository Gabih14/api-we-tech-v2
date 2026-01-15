import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Cupon } from '../../cupon/entities/cupon.entity';

@Entity('cupon_uso')
export class CuponUso {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'cupon_id', length: 50 })
  cuponId: string;

  @ManyToOne(() => Cupon, cupon => cupon.usos)
  @JoinColumn({ name: 'cupon_id' })
  cupon: Cupon;

  @Column({ length: 20 })
  cuit: string;

  @Column({ name: 'pedido_id', type: 'bigint', nullable: true })
  pedidoId: number;

  @Column({ name: 'usado_en', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  usadoEn: Date;
}