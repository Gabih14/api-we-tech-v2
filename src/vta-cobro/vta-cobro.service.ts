import { Injectable } from '@nestjs/common';
import { CreateVtaCobroDto } from './dto/create-vta-cobro.dto';
import { UpdateVtaCobroDto } from './dto/update-vta-cobro.dto';

@Injectable()
export class VtaCobroService {
  create(createVtaCobroDto: CreateVtaCobroDto) {
    return 'This action adds a new vtaCobro';
  }

  findAll() {
    return `This action returns all vtaCobro`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vtaCobro`;
  }

  update(id: number, updateVtaCobroDto: UpdateVtaCobroDto) {
    return `This action updates a #${id} vtaCobro`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaCobro`;
  }
}
