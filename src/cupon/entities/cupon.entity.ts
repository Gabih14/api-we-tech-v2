import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { CuponUso } from '../../cupon_uso/entities/cupon_uso.entity';
@Entity()
export class Cupon {
  @PrimaryColumn({ length: 50 })
  id: string;

  @Column({ length: 255, nullable: true })
  descripcion: string;

  @Column({ nullable: true })
  max_usos: number;

  @Column({ name: 'max_usos_por_cuit', nullable: true })
  maxUsosPorCuit: number;

  @Column({ name: 'fecha_desde', type: 'datetime', nullable: true })
  fechaDesde: Date;

  @Column({ name: 'fecha_hasta', type: 'datetime', nullable: true })
  fechaHasta: Date;

  @Column({ type: 'bit', default: () => "b'1'" })
  activo: boolean;

  @OneToMany(() => CuponUso, cuponUso => cuponUso.cupon)
  usos: CuponUso[];
}