import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { DeliveryConfigService } from './delivery-config.service';
import { CreateDeliveryConfigDto } from './dto/create-delivery-config.dto';
import { UpdateDeliveryConfigDto } from './dto/update-delivery-config.dto';
import { DeliveryConfig } from './entities/delivery-config.entity';

@Controller('delivery-config')
export class DeliveryConfigController {
  constructor(private readonly deliveryConfigService: DeliveryConfigService) {}

  @Post()
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreateDeliveryConfigDto): Promise<DeliveryConfig> {
    return this.deliveryConfigService.create(dto);
  }

  @Get()
  @AuthType('read')
  findAll(): Promise<DeliveryConfig[]> {
    return this.deliveryConfigService.findAll();
  }

  @Get(':id')
  @AuthType('read')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<DeliveryConfig> {
    return this.deliveryConfigService.findOne(id);
  }

  @Patch(':id')
  @AuthType('write')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryConfigDto,
  ): Promise<DeliveryConfig> {
    return this.deliveryConfigService.update(id, dto);
  }

  @Delete(':id')
  @AuthType('write')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deliveryConfigService.remove(id);
  }
}
