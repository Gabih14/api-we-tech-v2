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
      relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'], // incluir moneda para decidir cotización
    });

    // Combinás cada item con su precioVtaCotizadoMin (aplica cotización solo si la moneda es DOL)
    return items.map((item) => {
      const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');

      let precioVtaCotizadoMin: string | null = null;
      if (precioMinorista) {
        const precioVta = parseFloat(precioMinorista.precioVta || '0');
        const isDol = precioMinorista?.moneda?.id === 'DOL';
        const cot = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
        if (!isNaN(precioVta) && !isNaN(cot)) {
          precioVtaCotizadoMin = (precioVta * cot).toFixed(2);
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
      relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
    });

    if (!item) {
      throw new NotFoundException(`Item con id ${id} no encontrado`);
    }

    // Buscar el precio de la lista MINORISTA
    const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    
    let precioVtaCotizadoMin: string | null = null;
    if (precioMinorista) {
      const precioVta = parseFloat(precioMinorista.precioVta || '0');
      const isDol = precioMinorista?.moneda?.id === 'DOL';
      const cot = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
      if (!isNaN(precioVta) && !isNaN(cot)) {
        precioVtaCotizadoMin = (precioVta * cot).toFixed(2);
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
  // Helper de redondeo half-up
  const halfUp = (n: number) => Math.floor(n + 0.5);

  // Redondear la distancia hacia arriba
  distancia = Math.ceil(distancia);
  // Si la distancia es menor o igual a 4km, solo se cobra ENVIO HASTA 2KM
  if (distancia <= 4) {
      const item = await this.stkItemRepository.findOne({
        where: { id: 'ENVIO HASTA 2KM' },
        relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
      });
      if (!item) {
        throw new NotFoundException(`Item con id ENVIO HASTA 2KM no encontrado`);
      }
      const precioMinorista = item.stkPrecios?.find((p) => p.lista === 'MINORISTA');
      let precioVtaCotizadoMin: number | null = null;
      if (precioMinorista) {
        const v = parseFloat(precioMinorista.precioVta || '0');
        const isDol = precioMinorista?.moneda?.id === 'DOL';
        const cot = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
        if (!isNaN(v) && !isNaN(cot)) {
          precioVtaCotizadoMin = halfUp(v * cot);
        }
      }
      return {
        ...item,
        precioVtaCotizadoMin,
        costoTotal: precioVtaCotizadoMin,
        detalle: `Hasta 4km: ENVIO HASTA 2KM` 
      };
    }

    // Si la distancia es mayor a 4km, se cobra ENVIO HASTA 2KM + (km extra * ENVIO KM ADICIONAL)
    const item4km = await this.stkItemRepository.findOne({
      where: { id: 'ENVIO HASTA 2KM' },
      relations: ['stkPrecios', 'stkPrecios.moneda'],
    });
    const itemMas1km = await this.stkItemRepository.findOne({
      where: { id: 'ENVIO KM ADICIONAL' },
      relations: ['stkPrecios', 'stkPrecios.moneda'],
    });
    if (!item4km || !itemMas1km) {
      throw new NotFoundException(`No se encontró ENVIO HASTA 2KM o ENVIO KM ADICIONAL`);
    }
    // Precio base hasta 4km
    const precioMinorista4km = item4km.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    const precioMinoristaMas1km = itemMas1km.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    let precioVta4km = 0;
    let precioVtaMas1km = 0;
    if (precioMinorista4km) {
      const v = parseFloat(precioMinorista4km.precioVta || '0');
      const isDol = precioMinorista4km?.moneda?.id === 'DOL';
      const cot = isDol ? parseFloat(precioMinorista4km?.moneda?.cotizacion || '1') : 1;
      if (!isNaN(v) && !isNaN(cot)) {
        precioVta4km = halfUp(v * cot);
      }
    }
    if (precioMinoristaMas1km) {
      const v = parseFloat(precioMinoristaMas1km.precioVta || '0');
      const isDol = precioMinoristaMas1km?.moneda?.id === 'DOL';
      const cot = isDol ? parseFloat(precioMinoristaMas1km?.moneda?.cotizacion || '1') : 1;
      if (!isNaN(v) && !isNaN(cot)) {
        precioVtaMas1km = halfUp(v * cot);
      }
    }
    const kmExtras = Math.ceil(distancia - 4);
    const costoTotalBruto = precioVta4km + (kmExtras * precioVtaMas1km);
    const costoTotal = halfUp(costoTotalBruto);
    return {
      base: {
        id: 'ENVIO HASTA 2KM',
        precioVtaCotizadoMin: precioVta4km,
      },
      extra: {
        id: 'ENVIO KM ADICIONAL',
        precioVtaCotizadoMin: precioVtaMas1km,
        cantidad: kmExtras,
      },
      costoTotal,
      detalle: `Hasta 4km: ENVIO HASTA 2KM + ${kmExtras}km extra x ENVIO KM ADICIONAL`,
    };
  }
}
