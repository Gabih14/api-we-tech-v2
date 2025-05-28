// src/pedido/entities/pedido-item.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pedido } from './pedido.entity';

@Entity('pedido_item')
export class PedidoItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    nombre: string;

    @Column()
    cantidad: number;

    @Column()
    precio_unitario: number;

    @ManyToOne(() => Pedido, pedido => pedido.productos)
    pedido: Pedido;
}
