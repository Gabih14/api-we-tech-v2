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
        fotoUrl: this.extractFotoUrl(item.foto),
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
    // Nueva lógica: tomar el precio del item según la distancia sin cálculos
    // y si no existe ese item, redondear al siguiente más caro (mayor km) si existe.
    const kmInicial = Math.ceil(distancia);

    const findItemForKm = async (km: number) => {
      const id = `ENV-${String(km).padStart(2, '0')}K-GM-DELIVERY`;
      const item = await this.stkItemRepository.findOne({
        where: { id },
        relations: ['stkPrecios', 'stkPrecios.moneda', 'stkExistencias', 'familia2'],
      });
      return { id, item };
    };

    // Intentar con el km inicial y, si no existe, ir subiendo hasta encontrar el siguiente más caro
    let elegidoId = '';
    let elegidoItem: StkItem | null = null;

    // Intento exacto
    const exacto = await findItemForKm(kmInicial);
    if (exacto.item) {
      elegidoId = exacto.id;
      elegidoItem = exacto.item;
    } else {
      // Buscar el siguiente disponible hacia arriba (límite de búsqueda para evitar loops largos)
      const LIMITE_BUSQUEDA = 20;
      for (let delta = 1; delta <= LIMITE_BUSQUEDA; delta++) {
        const siguiente = await findItemForKm(kmInicial + delta);
        if (siguiente.item) {
          elegidoId = siguiente.id;
          elegidoItem = siguiente.item;
          break;
        }
      }
    }

    if (!elegidoItem) {
      throw new NotFoundException(
        `No se encontró item de envío para ${kmInicial}km ni un siguiente más caro disponible`,
      );
    }

    const precioMinorista = elegidoItem.stkPrecios?.find((p) => p.lista === 'MINORISTA');
    if (!precioMinorista) {
      throw new NotFoundException(`Precio MINORISTA no disponible para ${elegidoId}`);
    }

    // Tomar el precio tal cual está definido en el item, sin cálculos adicionales
    const precioVta = parseFloat(precioMinorista.precioVta || '0');
    const isDol = precioMinorista?.moneda?.id === 'DOL';
    const cotizacion = isDol ? parseFloat(precioMinorista?.moneda?.cotizacion || '1') : 1;
    const costoTotal = !isNaN(precioVta) && !isNaN(cotizacion)
      ? parseFloat((precioVta * cotizacion).toFixed(2))
      : precioVta;

    return {
      itemId: elegidoId,
      descripcion: (elegidoItem as any).descripcion,
      lista: 'MINORISTA',
      moneda: precioMinorista?.moneda?.id || null,
      precioVta,
      costoTotal,
    };
  }
  private extractFotoUrl(foto: Buffer | null): string | null {
  if (!foto) return null;

  const text = foto.toString('utf8');
  const match = text.match(/https?:\/\/[^\0]+/);

  return match ? match[0] : null;
}

}
