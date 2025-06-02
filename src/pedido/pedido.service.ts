// src/pedido/pedido.service.ts
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pedido } from './entities/pedido.entity';
import { Repository } from 'typeorm';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { StkExistenciaService } from 'src/stk-existencia/stk-existencia.service';
import { StkItem } from 'src/stk-item/entities/stk-item.entity';

@Injectable()
export class PedidoService {
  constructor(
  @InjectRepository(Pedido)
  private readonly pedidoRepo: Repository<Pedido>,

  @InjectRepository(StkItem)
  private readonly stkItemRepo: Repository<StkItem>,

  @Inject(forwardRef(() => StkExistenciaService))
  private readonly stockService: StkExistenciaService,
) {}


async crear(dto: CreatePedidoDto): Promise<Pedido> {
  const productosValidados: { nombre: string; cantidad: number; precio_unitario: number }[] = [];

  for (const producto of dto.productos) {
    const item = await this.stkItemRepo.findOne({
      where: { id: producto.nombre },
    });

    if (!item) {
      throw new NotFoundException(`Producto '${producto.nombre}' no existe en catálogo.`);
    }

    await this.stockService.reservarStock(item.id, producto.cantidad, 'DEPOSITO');

    productosValidados.push({
      nombre: producto.nombre,
      cantidad: producto.cantidad,
      precio_unitario: producto.precio_unitario,
    });
  }

  const pedido = this.pedidoRepo.create({
    cliente_cuit: dto.cliente_cuit,
    cliente_nombre: dto.cliente_nombre,
    external_id: dto.external_id,
    total: dto.total,
    estado: 'PENDIENTE',
    productos: productosValidados,
  });

  return this.pedidoRepo.save(pedido);
}

}
