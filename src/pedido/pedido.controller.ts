// src/pedido/pedido.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { AuthType } from '../common/decorators/auth-type.decorator';

@Controller('pedido')
@UseGuards(ApiTokenGuard)
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  async crear(@Body() dto: CreatePedidoDto) {
    return this.pedidoService.crear(dto);
  }

  @Post('nave-webhook')
  @AuthType('public')
  @HttpCode(HttpStatus.OK)
  async recibirWebhook(@Body() body: any) {
    console.log('📩 Webhook Nave recibido:', body);

    // ✅ Responder 200 inmediatamente
    // Procesar en background sin bloquear
    this.pedidoService.procesarNotificacionDeNave(body).catch((err) => {
      console.error('❌ Error procesando webhook Nave:', err);
    });

    return { message: 'Notificación recibida correctamente.' };
  }

  @Post('nave-webhook/test')
  @AuthType('public')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() body: any) {
    console.log('🧪 Webhook Nave TEST recibido:', body);

    // ✅ Responder 200 inmediatamente
    this.pedidoService.procesarNotificacionDeNave(body).catch((err) => {
      console.error('❌ Error procesando webhook TEST:', err);
    });

    return { message: 'Notificación recibida correctamente.', test: true };
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
