import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cliente_direccion_link')
export class ClienteDireccionLink {
  @PrimaryColumn({ name: 'cliente_id', type: 'varchar', length: 20 })
  clienteId: string;

  @Column({ type: 'varchar', length: 1024 })
  link: string;

  @Column({ name: 'direccion_texto', type: 'varchar', length: 512, nullable: true })
  direccionTexto: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  etiqueta: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamp' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamp' })
  actualizadoEn: Date;
}
