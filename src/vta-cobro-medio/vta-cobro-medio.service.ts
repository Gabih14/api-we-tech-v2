import { Injectable } from '@nestjs/common';
import { CreateVtaCobroMedioDto } from './dto/create-vta-cobro-medio.dto';
import { UpdateVtaCobroMedioDto } from './dto/update-vta-cobro-medio.dto';

@Injectable()
export class VtaCobroMedioService {
  create(createVtaCobroMedioDto: CreateVtaCobroMedioDto) {
    return 'This action adds a new vtaCobroMedio';
  }

  findAll() {
    return `This action returns all vtaCobroMedio`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vtaCobroMedio`;
  }

  update(id: number, updateVtaCobroMedioDto: UpdateVtaCobroMedioDto) {
    return `This action updates a #${id} vtaCobroMedio`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaCobroMedio`;
  }
}
