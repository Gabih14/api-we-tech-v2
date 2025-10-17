// src/pedido/pedido.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { AuthType } from '../common/decorators/auth-type.decorator';

@Controller('pedido')
@UseGuards(ApiTokenGuard) // 👈 Todos los endpoints usan API_TOKEN por defecto
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  async crear(@Body() dto: CreatePedidoDto) {
    return this.pedidoService.crear(dto); // retorna la URL de Nave
  }

  @Post('nave-webhook')
  @AuthType('public')
  @HttpCode(200) // 👈 Fuerza status 200 OK
  async recibirWebhook(@Body() body: any) {
    const { order_id, status } = body;

    const pedido = await this.pedidoService.encontrarPorExternalId(order_id);

    if (!pedido) {
      console.warn(`⚠ Pedido con order_id ${order_id} no encontrado.`);
      return { message: `Pedido no encontrado, se ignoró la notificación.` };
    }

    if (
      status === 'APPROVED' ||
      ['REJECTED', 'CANCELLED', 'REFUNDED'].includes(status)
    ) {
      await this.pedidoService.procesarNotificacionDeNave(body);
      return { message: `Webhook procesado con estado: ${status}` };
    }

    return {
      message: `Webhook recibido pero sin acción para estado: ${status}`,
    };
  }

  @Post('nave-webhook/test')
  @AuthType('public')
  @HttpCode(200) // respuesta 200
  async testWebhook(@Body() body: any) {
    return {
      message: '✅ Endpoint de prueba activo para Nave',
      received: body,
    };
  }

  @Get(':externalId')
  async getByExternalId(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.encontrarPorExternalId(externalId);
    if (!pedido) {
      throw new NotFoundException(`Pedido con external_id ${externalId} no encontrado.`);
    }
    return pedido;
  }
}
