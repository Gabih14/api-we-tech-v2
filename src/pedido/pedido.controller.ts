// src/pedido/pedido.controller.ts
import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';

@Controller('pedido')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  async crear(@Body() dto: CreatePedidoDto) {
    return this.pedidoService.crear(dto); // retorna la URL de Nave
  }

  @Post('nave-webhook')
  async recibirWebhook(@Body() body: any) {
    const { order_id, status } = body;

    const pedido = await this.pedidoService.encontrarPorExternalId(order_id);
    if (!pedido) {
      throw new NotFoundException(
        `Pedido con order_id ${order_id} no encontrado.`,
      );
    }

    if (
      status === 'APPROVED' ||
      ['REJECTED', 'CANCELLED', 'REFUNDED'].includes(status)
    ) {
      return this.pedidoService.procesarNotificacionDeNave(body);
    }

    return {
      message: `Webhook recibido pero sin acción para estado: ${status}`,
    };
  }


  @Post('nave-webhook/test')
  @AuthType('nave')
  @HttpCode(200) // respuesta 200
  async testWebhook(@Body() body: any) {
    return {
      message: '✅ Endpoint de prueba activo para Nave',
      received: body,
    };
  }

}
