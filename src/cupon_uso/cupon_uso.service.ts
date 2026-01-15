import { Injectable } from '@nestjs/common';
import { CreateCuponUsoDto } from './dto/create-cupon_uso.dto';
import { UpdateCuponUsoDto } from './dto/update-cupon_uso.dto';

@Injectable()
export class CuponUsoService {
  create(createCuponUsoDto: CreateCuponUsoDto) {
    return 'This action adds a new cuponUso';
  }

  findAll() {
    return `This action returns all cuponUso`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cuponUso`;
  }

  update(id: number, updateCuponUsoDto: UpdateCuponUsoDto) {
    return `This action updates a #${id} cuponUso`;
  }

  remove(id: number) {
    return `This action removes a #${id} cuponUso`;
  }
}
