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
  @HttpCode(200)
  async recibirWebhook(@Body() body: any) {
    console.log('📩 Webhook Nave recibido:', body);

    try {
      console.log('Procesando notificación de Nave: ', body);
      await this.pedidoService.procesarNotificacionDeNave(body);
      return { message: 'Notificación recibida y procesada correctamente.' };
    } catch (err) {
      console.error('❌ Error procesando notificación Nave:', err.message);
      return { message: `Error procesando webhook: ${err.message}` };
    }
  }

  @Post('nave-webhook/test')
  @AuthType('public')
  @HttpCode(200)
  async testWebhook(@Body() body: any) {
    console.log('🧪 Webhook Nave TEST recibido:', body);

    try {
      await this.pedidoService.procesarNotificacionDeNave(body);
      return { message: '[TEST] Notificación procesada correctamente.' };
    } catch (err) {
      console.error(
        '❌ [TEST] Error procesando notificación Nave:',
        err.message,
      );
      return { message: `[TEST] Error procesando webhook: ${err.message}` };
    }
  }

  @Get(':externalId')
  async getByExternalId(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.encontrarPorExternalId(externalId);
    if (!pedido) {
      throw new NotFoundException(
        `Pedido con external_id ${externalId} no encontrado.`,
      );
    }
    return pedido;
  }
}
