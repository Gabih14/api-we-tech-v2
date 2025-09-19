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

    // Obtener la cotización del dólar
    const cotizacionDolar = await this.stkPrecioService.getCotizacionDolar();

    // Combinás cada item con su precioVtaCotizadoMin
    return items.map((item) => {
      // Buscar el precio de la lista MINORISTA
      const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
      
      let precioVtaCotizadoMin: string | null = null;
      if (precioMinorista) {
        const precioVta = parseFloat(precioMinorista.precioVta || '0');
        if (!isNaN(precioVta) && !isNaN(cotizacionDolar)) {
          precioVtaCotizadoMin = (precioVta * cotizacionDolar).toFixed(2);
        }
      }

      return {
        ...item,
        precioVtaCotizadoMin,
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

    // Obtener la cotización del dólar
    const cotizacionDolar = await this.stkPrecioService.getCotizacionDolar();

    // Buscar el precio de la lista MINORISTA
    const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    
    let precioVtaCotizadoMin: string | null = null;
    if (precioMinorista) {
      const precioVta = parseFloat(precioMinorista.precioVta || '0');
      if (!isNaN(precioVta) && !isNaN(cotizacionDolar)) {
        precioVtaCotizadoMin = (precioVta * cotizacionDolar).toFixed(2);
      }
    }

    return {
      ...item,
      precioVtaCotizadoMin,
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

  async getCostoEnvio(distancia: number): Promise<any> {
    // Determinar qué item de envío usar según la distancia
    let itemId: string;
    
    if (distancia <= 3) {
      itemId = 'ENVIO3KM';
    } else if (distancia <= 5) {
      itemId = 'ENVIO5KM';
    } else if (distancia <= 7) {
      itemId = 'ENVIO7KM';
    } else if (distancia <= 12) {
      itemId = 'ENVIO12KM';
    } else if (distancia <= 17) {
      itemId = 'ENVIO17KM';
    } else {
      throw new NotFoundException(`No hay servicio de envío para distancias mayores a 17km`);
    }

    const item = await this.stkItemRepository.findOne({
      where: { id: itemId },
      relations: ['stkPrecios', 'stkExistencias', 'familia2'],
    });

    if (!item) {
      throw new NotFoundException(`Item con id ${itemId} no encontrado`);
    }

    // Obtener la cotización del dólar
    const cotizacionDolar = await this.stkPrecioService.getCotizacionDolar();

    // Buscar el precio de la lista MINORISTA
    const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    
    let precioVtaCotizadoMin: string | null = null;
    if (precioMinorista) {
      const precioVta = parseFloat(precioMinorista.precioVta || '0');
      if (!isNaN(precioVta) && !isNaN(cotizacionDolar)) {
        precioVtaCotizadoMin = (precioVta * cotizacionDolar).toFixed(2);
      }
    }

    return {
      ...item,
      precioVtaCotizadoMin,
      distanciaMaxima: distancia <= 3 ? 3 : distancia <= 5 ? 5 : distancia <= 7 ? 7 : distancia <= 12 ? 12 : 17,
    };
  }
}
