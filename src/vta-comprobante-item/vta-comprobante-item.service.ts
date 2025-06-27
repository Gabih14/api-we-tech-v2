import { Injectable } from '@nestjs/common';
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
  ) { }

  async create(dto: CreateVtaComprobanteItemDto): Promise<VtaComprobanteItem> {
    const comprobante = await this.compRepo.findOneByOrFail({
      tipo: dto.tipo,
      comprobante: dto.comprobante,
    });

    const item = await this.stkItemRepo.findOneByOrFail({ id: String(dto.itemId) });

    const nuevoItem = this.itemRepo.create({
      ...dto,
      comprobante,
      item,
    });

    return this.itemRepo.save(nuevoItem);
  }

  findAll(): Promise<VtaComprobanteItem[]> {
    return this.itemRepo.find({ relations: ['comprobante', 'item'] });
  }

  async findOne(id: number): Promise<VtaComprobanteItem> {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: ['comprobante', 'item'],
    });
    if (!item) {
      throw new Error(`VtaComprobanteItem with id ${id} not found`);
    }
    return item;
  }

  async update(id: number, dto: UpdateVtaComprobanteItemDto): Promise<VtaComprobanteItem> {
    const item = await this.itemRepo.findOneByOrFail({ id });

    if (dto.comprobante && dto.tipo) {
      item.comprobante = await this.compRepo.findOneByOrFail({
        tipo: dto.tipo,
        comprobante: dto.comprobante,
      });
    }

    if (dto.itemId) {
      item.item = await this.stkItemRepo.findOneByOrFail({ id: String(dto.itemId) });
    }

    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async remove(id: number): Promise<void> {
    await this.itemRepo.delete(id);
  }
}
