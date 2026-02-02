import { Injectable } from '@nestjs/common';
import { CreateCntMovimientoDto } from './dto/create-cnt-movimiento.dto';
import { UpdateCntMovimientoDto } from './dto/update-cnt-movimiento.dto';

@Injectable()
export class CntMovimientoService {
  create(createCntMovimientoDto: CreateCntMovimientoDto) {
    return 'This action adds a new cntMovimiento';
  }

  findAll() {
    return `This action returns all cntMovimiento`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cntMovimiento`;
  }

  update(id: number, updateCntMovimientoDto: UpdateCntMovimientoDto) {
    return `This action updates a #${id} cntMovimiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} cntMovimiento`;
  }
}
