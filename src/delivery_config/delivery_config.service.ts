import { Injectable } from '@nestjs/common';
import { CreateDeliveryConfigDto } from './dto/create-delivery_config.dto';
import { UpdateDeliveryConfigDto } from './dto/update-delivery_config.dto';

@Injectable()
export class DeliveryConfigService {
  create(createDeliveryConfigDto: CreateDeliveryConfigDto) {
    return 'This action adds a new deliveryConfig';
  }

  findAll() {
    return `This action returns all deliveryConfig`;
  }

  findOne(id: number) {
    return `This action returns a #${id} deliveryConfig`;
  }

  update(id: number, updateDeliveryConfigDto: UpdateDeliveryConfigDto) {
    return `This action updates a #${id} deliveryConfig`;
  }

  remove(id: number) {
    return `This action removes a #${id} deliveryConfig`;
  }
}
