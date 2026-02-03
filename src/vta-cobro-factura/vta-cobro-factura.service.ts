import { Injectable } from '@nestjs/common';
import { CreateVtaCobroFacturaDto } from './dto/create-vta-cobro-factura.dto';
import { UpdateVtaCobroFacturaDto } from './dto/update-vta-cobro-factura.dto';

@Injectable()
export class VtaCobroFacturaService {
  create(createVtaCobroFacturaDto: CreateVtaCobroFacturaDto) {
    return 'This action adds a new vtaCobroFactura';
  }

  findAll() {
    return `This action returns all vtaCobroFactura`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vtaCobroFactura`;
  }

  update(id: number, updateVtaCobroFacturaDto: UpdateVtaCobroFacturaDto) {
    return `This action updates a #${id} vtaCobroFactura`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaCobroFactura`;
  }
}
