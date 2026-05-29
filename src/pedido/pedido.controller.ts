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
  Query,
} from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { ApiTokenGuard } from '../common/guards/api-token.guard';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { GetPedidosDashboardDto } from './dto/get-pedidos-dashboard.dto';
import { Throttle } from '@nestjs/throttler';
import {
  DEFAULT_RATE_LIMIT_NAVE_WEBHOOK,
  DEFAULT_RATE_LIMIT_NAVE_WEBHOOK_TEST,
  DEFAULT_RATE_LIMIT_PEDIDO_CREATE,
  DEFAULT_RATE_LIMIT_TTL_MS,
  RATE_LIMIT_NAVE_WEBHOOK,
  RATE_LIMIT_PEDIDO_CREATE,
  RATE_LIMIT_TTL_MS,
  rateLimitValue,
} from '../common/rate-limit/rate-limit.config';

@Controller('pedido')
@UseGuards(ApiTokenGuard)
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  @Throttle({
    default: {
      ttl: rateLimitValue(RATE_LIMIT_TTL_MS, DEFAULT_RATE_LIMIT_TTL_MS),
      limit: rateLimitValue(
        RATE_LIMIT_PEDIDO_CREATE,
        DEFAULT_RATE_LIMIT_PEDIDO_CREATE,
      ),
    },
  })
  async crear(@Body() dto: CreatePedidoDto) {
    return this.pedidoService.crear(dto);
  }

  @Post('nave-webhook')
  @Throttle({
    default: {
      ttl: rateLimitValue(RATE_LIMIT_TTL_MS, DEFAULT_RATE_LIMIT_TTL_MS),
      limit: rateLimitValue(
        RATE_LIMIT_NAVE_WEBHOOK,
        DEFAULT_RATE_LIMIT_NAVE_WEBHOOK,
      ),
    },
  })
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
  @Throttle({
    default: {
      ttl: rateLimitValue(RATE_LIMIT_TTL_MS, DEFAULT_RATE_LIMIT_TTL_MS),
      limit: rateLimitValue(
        RATE_LIMIT_NAVE_WEBHOOK,
        DEFAULT_RATE_LIMIT_NAVE_WEBHOOK_TEST,
      ),
    },
  })
  @AuthType('public')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() body: any) {
    console.log('🧪 Webhook Nave TEST recibido:', body);

    const resultado = await this.pedidoService.procesarNotificacionDeNave(body);

    return { message: 'Notificación procesada correctamente.', estado: resultado.estado, test: true };
  }

  @Get()
  @AuthType('dashboard')
  async listarDashboard(@Query() query: GetPedidosDashboardDto) {
    return this.pedidoService.listarParaDashboard(query);
  }

  @Get(':externalId')
  @AuthType('dashboard')
  async getByExternalId(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.encontrarPorExternalId(externalId);
    if (!pedido) {
      throw new NotFoundException(
        `Pedido con external_id ${externalId} no encontrado.`,
      );
    }
    return pedido;
  }

  @Post(':externalId/cancelar')
  @AuthType('dashboard')
  @HttpCode(HttpStatus.OK)
  async cancelarPedido(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.cancelarPedidoPendiente(externalId);
    return {
      message: 'Pedido cancelado correctamente',
      pedido,
    };
  }

  @Post(':externalId/rechazar')
  @AuthType('dashboard')
  @HttpCode(HttpStatus.OK)
  async rechazarTransferencia(@Param('externalId') externalId: string) {
    const pedido = await this.pedidoService.rechazarTransferencia(externalId);
    return {
      message: 'Pedido rechazado correctamente',
      pedido,
    };
  }
}
