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
  // Redondear la distancia hacia arriba
  distancia = Math.ceil(distancia);
  // Si la distancia es menor o igual a 4km, solo se cobra ENVIO4KM
  if (distancia <= 4) {
      const item = await this.stkItemRepository.findOne({
        where: { id: 'ENVIO4KM' },
        relations: ['stkPrecios', 'stkExistencias', 'familia2'],
      });
      if (!item) {
        throw new NotFoundException(`Item con id ENVIO4KM no encontrado`);
      }
      const cotizacionDolar = await this.stkPrecioService.getCotizacionDolar();
      const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
      let precioVtaCotizadoMin: number | null = null;
      if (precioMinorista) {
        const precioVta = parseFloat(precioMinorista.precioVta || '0');
        if (!isNaN(precioVta) && !isNaN(cotizacionDolar)) {
          const bruto = precioVta * cotizacionDolar;
          precioVtaCotizadoMin = Math.ceil(bruto - 0.5) + (bruto - Math.ceil(bruto - 0.5) >= 0.5 ? 1 : 0);
          // Alternativamente, simplemente Math.round(bruto) si quieres redondeo clásico
        }
      }
      return {
        ...item,
        precioVtaCotizadoMin,
        costoTotal: precioVtaCotizadoMin,
        detalle: `Hasta 4km: ENVIO4KM` 
      };
    }

    // Si la distancia es mayor a 4km, se cobra ENVIO4KM + (km extra * ENVIO+1KM)
    const item4km = await this.stkItemRepository.findOne({
      where: { id: 'ENVIO4KM' },
      relations: ['stkPrecios'],
    });
    const itemMas1km = await this.stkItemRepository.findOne({
      where: { id: 'ENVIO+1KM' },
      relations: ['stkPrecios'],
    });
    if (!item4km || !itemMas1km) {
      throw new NotFoundException(`No se encontró ENVIO4KM o ENVIO+1KM`);
    }
    const cotizacionDolar = await this.stkPrecioService.getCotizacionDolar();
    // Precio base hasta 4km
    const precioMinorista4km = item4km.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    const precioMinoristaMas1km = itemMas1km.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    let precioVta4km = 0;
    let precioVtaMas1km = 0;
    if (precioMinorista4km) {
      const v = parseFloat(precioMinorista4km.precioVta || '0');
      if (!isNaN(v) && !isNaN(cotizacionDolar)) {
        const bruto = v * cotizacionDolar;
        precioVta4km = Math.ceil(bruto - 0.5) + (bruto - Math.ceil(bruto - 0.5) >= 0.5 ? 1 : 0);
      }
    }
    if (precioMinoristaMas1km) {
      const v = parseFloat(precioMinoristaMas1km.precioVta || '0');
      if (!isNaN(v) && !isNaN(cotizacionDolar)) {
        const bruto = v * cotizacionDolar;
        precioVtaMas1km = Math.ceil(bruto - 0.5) + (bruto - Math.ceil(bruto - 0.5) >= 0.5 ? 1 : 0);
      }
    }
    const kmExtras = Math.ceil(distancia - 4);
    const costoTotalBruto = precioVta4km + (kmExtras * precioVtaMas1km);
    const costoTotal = Math.ceil(costoTotalBruto - 0.5) + (costoTotalBruto - Math.ceil(costoTotalBruto - 0.5) >= 0.5 ? 1 : 0);
    return {
      base: {
        id: 'ENVIO4KM',
        precioVtaCotizadoMin: precioVta4km,
      },
      extra: {
        id: 'ENVIO+1KM',
        precioVtaCotizadoMin: precioVtaMas1km,
        cantidad: kmExtras,
      },
      costoTotal,
      detalle: `Hasta 4km: ENVIO4KM + ${kmExtras}km extra x ENVIO+1KM`,
    };
  }
}
