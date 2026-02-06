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

    // ✅ Procesar sincrónico
    // Si hay error, lanza excepción y NestJS retorna 4xx/5xx
    // Si éxito, retorna 200 OK
    const resultado = await this.pedidoService.procesarNotificacionDeNave(body);

    return { message: 'Notificación procesada correctamente.', estado: resultado.estado };
  }

  @Post('nave-webhook/test')
  @AuthType('public')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() body: any) {
    console.log('🧪 Webhook Nave TEST recibido:', body);

    const resultado = await this.pedidoService.procesarNotificacionDeNave(body);

    return { message: 'Notificación procesada correctamente.', estado: resultado.estado, test: true };
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

  @Post(':externalId/aprobar')
  @HttpCode(HttpStatus.OK)
  async aprobarTransferencia(@Param('externalId') externalId: string) {
    const resultado = await this.pedidoService.aprobarTransferencia(externalId);
    return {
      message: 'Pedido aprobado correctamente',
      pedido: resultado.pedido,
      comprobante: resultado.comprobante,
    };
  }

  @Post(':externalId/rechazar')
  @HttpCode(HttpStatus.OK)
  async rechazarTransferencia(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.rechazarTransferencia(externalId);
    return {
      message: 'Pedido rechazado correctamente',
      pedido,
    };
  }
}
