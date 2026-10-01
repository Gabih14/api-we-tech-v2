import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoMayorista {
  NO_SOLICITADO = 'NO_SOLICITADO',
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

@Entity('ecommerce_usuario')
export class EcommerceUsuario {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'clerk_user_id', type: 'varchar', length: 255, unique: true })
  clerkUserId: string;

  @Column({ name: 'cliente_id', type: 'varchar', length: 20, nullable: true })
  clienteId: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  cuit: string | null;

  @Column({ name: 'razon_social', type: 'varchar', length: 100, nullable: true })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({
    name: 'estado_mayorista',
    type: 'enum',
    enum: EstadoMayorista,
    default: EstadoMayorista.NO_SOLICITADO,
  })
  estadoMayorista: EstadoMayorista;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
