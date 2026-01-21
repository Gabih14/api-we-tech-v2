import { Injectable } from '@nestjs/common';
import { CreateVtaComprobanteAsientoDto } from './dto/create-vta_comprobante_asiento.dto';
import { UpdateVtaComprobanteAsientoDto } from './dto/update-vta_comprobante_asiento.dto';

@Injectable()
export class VtaComprobanteAsientoService {
  create(createVtaComprobanteAsientoDto: CreateVtaComprobanteAsientoDto) {
    return 'This action adds a new vtaComprobanteAsiento';
  }

  findAll() {
    return `This action returns all vtaComprobanteAsiento`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vtaComprobanteAsiento`;
  }

  update(id: number, updateVtaComprobanteAsientoDto: UpdateVtaComprobanteAsientoDto) {
    return `This action updates a #${id} vtaComprobanteAsiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaComprobanteAsiento`;
  }
}
