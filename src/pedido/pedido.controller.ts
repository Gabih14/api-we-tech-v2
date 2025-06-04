// src/pedido/pedido.controller.ts
import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';

@Controller('pedido')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  async crear(@Body() dto: CreatePedidoDto) {
    return this.pedidoService.crear(dto);
  }

    @Post('nave-webhook')
  async recibirWebhook(@Body() body: any) {
    const { order_id, status, happened_at, amount, payment_method } = body;

    const pedido = await this.pedidoService.encontrarPorExternalId(order_id);

    if (!pedido) {
      throw new NotFoundException(`Pedido con order_id ${order_id} no encontrado.`);
    }

    // Si el estado es aprobado, actualizamos el pedido
    if (status === 'APPROVED') {
      return this.pedidoService.marcarComoAprobado(pedido.id, {
        estado: status,
        fechaPago: happened_at,
        montoPagado: amount?.value,
        medioPago: payment_method?.id ?? 'desconocido',
      });
    }

    // Podés manejar otros estados también si querés
    return { message: `Webhook recibido pero sin acción para estado: ${status}` };
  }
}

