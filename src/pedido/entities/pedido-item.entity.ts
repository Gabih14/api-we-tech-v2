// src/pedido/entities/pedido-item.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pedido } from './pedido.entity';

@Entity('pedido_item')
export class PedidoItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    nombre: string;

    @Column({ nullable: true })
    descripcion: string;

    @Column()
    cantidad: number;

    @Column()
    precio_unitario: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    ajuste_porcentaje: number | null;

    @ManyToOne(() => Pedido, pedido => pedido.productos)
    pedido: Pedido;
}
