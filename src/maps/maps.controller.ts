import { Controller, Post, Body } from '@nestjs/common';
import { MapsService } from './maps.service';
import { GetDistanceDto } from './dto/get-distance.dto';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('distance')
  async getDistance(@Body() dto: GetDistanceDto) {
    return await this.mapsService.getDistanceToDestination(dto.address, dto.city);
  }
}
