import { Controller, Post, Body } from '@nestjs/common';
import { MapsService } from './maps.service';
import { GetDistanceDto } from './dto/get-distance.dto';
import { Throttle } from '@nestjs/throttler';
import {
  DEFAULT_RATE_LIMIT_MAPS_DISTANCE,
  DEFAULT_RATE_LIMIT_TTL_MS,
  RATE_LIMIT_MAPS_DISTANCE,
  RATE_LIMIT_TTL_MS,
  rateLimitValue,
} from '../common/rate-limit/rate-limit.config';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('distance')
  @Throttle({
    default: {
      ttl: rateLimitValue(RATE_LIMIT_TTL_MS, DEFAULT_RATE_LIMIT_TTL_MS),
      limit: rateLimitValue(
        RATE_LIMIT_MAPS_DISTANCE,
        DEFAULT_RATE_LIMIT_MAPS_DISTANCE,
      ),
    },
  })
  async getDistance(@Body() dto: GetDistanceDto) {
    return await this.mapsService.getDistanceToDestination(dto.address, dto.city);
  }
}
