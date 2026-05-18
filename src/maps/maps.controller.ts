import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MapsService } from './maps.service';
import { GetDistanceDto } from './dto/get-distance.dto';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('distance')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async getDistance(@Body() dto: GetDistanceDto) {
    return await this.mapsService.getDistanceToDestination(dto.address, dto.city);
  }
}
