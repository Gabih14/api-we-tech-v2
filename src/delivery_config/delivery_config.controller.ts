import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DeliveryConfigService } from './delivery_config.service';
import { CreateDeliveryConfigDto } from './dto/create-delivery_config.dto';
import { UpdateDeliveryConfigDto } from './dto/update-delivery_config.dto';

@Controller('delivery-config')
export class DeliveryConfigController {
  constructor(private readonly deliveryConfigService: DeliveryConfigService) {}

  @Post()
  create(@Body() createDeliveryConfigDto: CreateDeliveryConfigDto) {
    return this.deliveryConfigService.create(createDeliveryConfigDto);
  }

  @Get()
  findAll() {
    return this.deliveryConfigService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryConfigService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeliveryConfigDto: UpdateDeliveryConfigDto) {
    return this.deliveryConfigService.update(+id, updateDeliveryConfigDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryConfigService.remove(+id);
  }
}
