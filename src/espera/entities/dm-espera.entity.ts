import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DmEsperaTipo = 'filamento' | 'repuesto' | 'impresora';

@Index('prod', ['prod'])
@Index('cliente_id', ['clienteId'])
@Index('avisado', ['avisado'])
@Entity('dm_espera')
export class DmEspera {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('enum', {
    name: 'tipo',
    enum: ['filamento', 'repuesto', 'impresora'],
  })
  tipo: DmEsperaTipo;

  @Column('varchar', { name: 'prod', length: 255 })
  prod: string;

  @Column('varchar', { name: 'cliente_id', nullable: true, length: 20 })
  clienteId: string | null;

  @Column('varchar', { name: 'cliente_nombre', length: 150 })
  clienteNombre: string;

  @Column('varchar', { name: 'cliente_tel', nullable: true, length: 40 })
  clienteTel: string | null;

  @Column('int', { name: 'cantidad', default: () => "'1'" })
  cantidad: number;

  @Column('varchar', { name: 'nota', nullable: true, length: 500 })
  nota: string | null;

  @Column('tinyint', { name: 'avisado', default: () => "'0'" })
  avisado: number;

  @Column('datetime', { name: 'avisado_en', nullable: true })
  avisadoEn: Date | null;

  @Column('varchar', { name: 'usuario', nullable: true, length: 50 })
  usuario: string | null;

  @Column('timestamp', {
    name: 'creado_en',
    default: () => 'CURRENT_TIMESTAMP',
  })
  creadoEn: Date;
}
