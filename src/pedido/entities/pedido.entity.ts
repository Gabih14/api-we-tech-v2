// src/pedido/entities/pedido.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { PedidoItem } from './pedido-item.entity';

@Entity('pedido')
export class Pedido {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cliente_cuit: string;

  @Column()
  cliente_nombre: string;

  @Column()
  external_id: string; // ID de Nave

  @Column()
  total: number;

  @Column({ default: 'PENDIENTE' })
  estado: 'PENDIENTE' | 'APROBADO' | 'CANCELADO';

  @OneToMany(() => PedidoItem, item => item.pedido, { cascade: true })
  productos: PedidoItem[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  creado: Date;

  @Column({ type: 'timestamp', nullable: true })
  aprobado: Date;

  @Column()
  cliente_mail: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costo_envio: number;

  // Información de cupón aplicado
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  descuento_cupon: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  codigo_cupon: string | null;

  @Column({
    type: 'enum',
    enum: ['pickup', 'shipping'],
    nullable: true,
    default: 'pickup',
  })
  delivery_method: 'pickup' | 'shipping';

  @Column({ type: 'varchar', length: 512, nullable: true })
  cliente_ubicacion: string;

  @Column({ type: 'text', nullable: true })
  observaciones_direccion: string | null;

  @Column({
    type: 'enum',
    enum: ['online', 'transfer'],
    nullable: true,
    default: 'online',
  })
  metodo_pago: 'online' | 'transfer';

  @Column({ type: 'varchar', length: 4, nullable: true })
  comprobante_tipo: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  comprobante_numero: string | null;
}
