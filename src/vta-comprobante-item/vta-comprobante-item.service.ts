import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaComprobanteItem } from './entities/vta-comprobante-item.entity';
import { CreateVtaComprobanteItemDto } from './dto/create-vta-comprobante-item.dto';
import { UpdateVtaComprobanteItemDto } from './dto/update-vta-comprobante-item.dto';
import { VtaComprobante } from '../vta-comprobante/entities/vta-comprobante.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

@Injectable()
export class VtaComprobanteItemService {
  constructor(
    @InjectRepository(VtaComprobanteItem)
    private readonly itemRepo: Repository<VtaComprobanteItem>,
    @InjectRepository(VtaComprobante)
    private readonly compRepo: Repository<VtaComprobante>,
    @InjectRepository(StkItem)
    private readonly stkItemRepo: Repository<StkItem>,
  ) {}

  async create(dto: CreateVtaComprobanteItemDto): Promise<VtaComprobanteItem> {
    const comprobante = await this.compRepo.findOneByOrFail({
      tipo: dto.tipo,
      comprobante: dto.comprobante,
    });

    const item = await this.stkItemRepo.findOneByOrFail({
      id: String(dto.itemId),
    });

    const entity = this.itemRepo.create({
      tipo: dto.tipo,
      comprobante: dto.comprobante,
      linea: dto.linea,
      cantidad: dto.cantidad,
      precio: dto.precio,
      importe: dto.importe,
      comprobanteRef: comprobante,
      item,
    });

    return this.itemRepo.save(entity);
  }

  findAll(): Promise<VtaComprobanteItem[]> {
    return this.itemRepo.find({
      relations: ['comprobanteRef', 'item'],
    });
  }

  async findOne(tipo: string, comprobante: string, linea: number): Promise<VtaComprobanteItem> {
    const item = await this.itemRepo.findOne({
      where: { tipo, comprobante, linea },
      relations: ['comprobanteRef', 'item'],
    });

    if (!item) {
      throw new NotFoundException(`Item ${tipo}-${comprobante}-${linea} not found`);
    }

    return item;
  }

  async update(
    tipo: string,
    comprobante: string,
    linea: number,
    dto: UpdateVtaComprobanteItemDto,
  ): Promise<VtaComprobanteItem> {
    const item = await this.itemRepo.findOneByOrFail({ tipo, comprobante, linea });

    if (dto.itemId) {
      item.item = await this.stkItemRepo.findOneByOrFail({
        id: String(dto.itemId),
      });
    }

    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async remove(tipo: string, comprobante: string, linea: number): Promise<void> {
    await this.itemRepo.delete({ tipo, comprobante, linea });
  }
}
