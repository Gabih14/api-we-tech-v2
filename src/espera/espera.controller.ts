import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthType } from '../common/decorators/auth-type.decorator';
import {
  DEFAULT_RATE_LIMIT_ESPERA_CREATE,
  DEFAULT_RATE_LIMIT_TTL_MS,
  RATE_LIMIT_ESPERA_CREATE,
  RATE_LIMIT_TTL_MS,
  rateLimitValue,
} from '../common/rate-limit/rate-limit.config';
import { CreateEsperaDto } from './dto/create-espera.dto';
import { EsperaResponse, EsperaService } from './espera.service';

@Controller('espera')
export class EsperaController {
  constructor(private readonly esperaService: EsperaService) {}

  @Post()
  @AuthType('public')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: {
      ttl: rateLimitValue(RATE_LIMIT_TTL_MS, DEFAULT_RATE_LIMIT_TTL_MS),
      limit: rateLimitValue(
        RATE_LIMIT_ESPERA_CREATE,
        DEFAULT_RATE_LIMIT_ESPERA_CREATE,
      ),
    },
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async crear(@Body() dto: CreateEsperaDto): Promise<EsperaResponse> {
    return this.esperaService.crear(dto);
  }
}
