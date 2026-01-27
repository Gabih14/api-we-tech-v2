import { Injectable } from '@nestjs/common';
import { CreateCntAsientoDto } from './dto/create-cnt-asiento.dto';
import { UpdateCntAsientoDto } from './dto/update-cnt-asiento.dto';

@Injectable()
export class CntAsientoService {
  create(createCntAsientoDto: CreateCntAsientoDto) {
    return 'This action adds a new cntAsiento';
  }

  findAll() {
    return `This action returns all cntAsiento`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cntAsiento`;
  }

  update(id: number, updateCntAsientoDto: UpdateCntAsientoDto) {
    return `This action updates a #${id} cntAsiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} cntAsiento`;
  }
}
