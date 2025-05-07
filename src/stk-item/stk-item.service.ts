import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkItem } from './entities/stk-item.entity';
import { CreateStkItemDto } from './dto/create-stk-item.dto';
import { UpdateStkItemDto } from './dto/update-stk-item.dto';
import { StkFamilia } from 'src/stk_familia/entities/stk_familia.entity';
import { StkPrecioService } from 'src/stk-precio/stk-precio.service';

@Injectable()
export class StkItemService {
  constructor(
    @InjectRepository(StkItem)
    private readonly stkItemRepository: Repository<StkItem>,
    @InjectRepository(StkFamilia)
    private readonly stkFamiliaRepository: Repository<StkFamilia>,
    
    private readonly stkPrecioService: StkPrecioService,
  ) {}

  async create(createStkItemDto: CreateStkItemDto): Promise<StkItem> {
    const item = this.stkItemRepository.create(createStkItemDto);
    return this.stkItemRepository.save(item);
  }

  async findAll(): Promise<any[]> {
    const items = await this.stkItemRepository.find({
      relations: ['stkPrecios', 'stkExistencias', 'familia2'], // agregás relaciones necesarias
    });

    // Traés todos los precios
    const precios = await this.stkPrecioService.findAll();

    // Combinás cada item con su precioVtaCotizado
    return items.map((item) => {
      const precioItem = precios.find((p) => p.item2?.id === item.id);

      return {
        ...item,
        precioVtaCotizado: precioItem?.precioVtaCotizado || null,
      };
    });
  }

  async findOne(id: string): Promise<any> {
    const item = await this.stkItemRepository.findOne({
      where: { id },
      relations: ['stkPrecios', 'stkExistencias', 'familia2'],
    });

    if (!item) {
      throw new NotFoundException(`Item con id ${id} no encontrado`);
    }

    // Traés el precio específico
    const precioItem = await this.stkPrecioService.findOne('LISTA_ID', id); 
    // 👆🏻 Acá debes reemplazar 'LISTA_ID' con la lista que uses, o parametrizarlo

    return {
      ...item,
      precioVtaCotizado: precioItem?.precioVtaCotizado || null,
    };
  }

  async update(id: string, updateStkItemDto: UpdateStkItemDto): Promise<StkItem> {
    const stkItem = await this.findOne(id); // Verifica si el item existe
  
    if (updateStkItemDto.familiaId) {
      const familia = await this.stkFamiliaRepository.findOne({
        where: { id: updateStkItemDto.familiaId },
      });
  
      if (!familia) {
        throw new NotFoundException(`Familia con id ${updateStkItemDto.familiaId} no encontrada`);
      }
  
      // Asignamos la entidad familia al item
      (stkItem as any).familia = familia;
    }
  
    // Actualizamos el resto de los campos
    Object.assign(stkItem, updateStkItemDto);
  
    return this.stkItemRepository.save(stkItem);
  }
  

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.stkItemRepository.remove(item);
  }
}
