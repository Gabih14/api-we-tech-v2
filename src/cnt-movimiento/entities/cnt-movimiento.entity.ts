// src/cnt-movimiento/entities/cnt-movimiento.entity.ts
import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';

@Index('cuenta', ['cuenta'])
@Index('proyecto', ['proyecto'])
@Entity({ name: 'cnt_movimiento', schema: 'wetech' }) // <- sacá schema si ya lo tenés definido global
export class CntMovimiento {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  ejercicio: string;

  // En DB esta columna se llama "asiento" pero referencia a cnt_asiento.id
  @PrimaryColumn({ type: 'int' })
  asiento: number;

  @PrimaryColumn({ type: 'int' })
  numero: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cuenta: string | null;

  // DECIMAL en TypeORM suele venir como string (está bien así)
  @Column({ type: 'decimal', precision: 17, scale: 2, nullable: true })
  debe: string | null;

  @Column({ type: 'decimal', precision: 17, scale: 2, nullable: true })
  haber: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  leyenda: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  proyecto: string | null;

  @ManyToOne(() => CntAsiento, (a) => a.movimientos, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'ejercicio', referencedColumnName: 'ejercicio' },
    { name: 'asiento', referencedColumnName: 'id' },
  ])
  asientoRef: CntAsiento;
}
