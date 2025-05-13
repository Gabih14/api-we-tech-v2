import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkFamilia } from './entities/stk_familia.entity';
import { CreateStkFamiliaDto } from './dto/create-stk_familia.dto';
import { StkPrecioService } from 'src/stk-precio/stk-precio.service';

@Injectable()
export class StkFamiliaService {
  constructor(
    @InjectRepository(StkFamilia)
    private readonly stkFamiliaRepository: Repository<StkFamilia>,
    private readonly stkPrecioService: StkPrecioService,
  ) {}

  async create(createStkFamiliaDto: CreateStkFamiliaDto): Promise<StkFamilia> {
    const familia = this.stkFamiliaRepository.create(createStkFamiliaDto);
    return await this.stkFamiliaRepository.save(familia);
  }

  async findAll(): Promise<any[]> {
    const familias = await this.stkFamiliaRepository.find({
      relations: ['stkItems', 'stkItems.stkExistencias', 'stkItems.stkPrecios'],
    });

    const dolar = await this.stkPrecioService.getCotizacionDolar();

    return familias.map((familia) => {
      return {
        ...familia,
        stkItems: familia.stkItems.map((item) => ({
          ...item,
          stkExistencias: item.stkExistencias,
          stkPrecios: item.stkPrecios.map((precio) => ({
            ...precio,
            precioVtaCotizado: (parseFloat(precio.precioVta || '0') * dolar).toFixed(2),
          })),
        })),
      };
    });
  }

  async findOne(id: string): Promise<any> {
    const familia = await this.stkFamiliaRepository.findOne({
      where: { id },
      relations: ['stkItems', 'stkItems.stkExistencias', 'stkItems.stkPrecios'],
    });

    if (!familia) return null;

    const dolar = await this.stkPrecioService.getCotizacionDolar();

    return {
      ...familia,
      stkItems: familia.stkItems.map((item) => ({
        ...item,
        stkExistencias: item.stkExistencias,
        stkPrecios: item.stkPrecios.map((precio) => ({
          ...precio,
          precioVtaCotizado: (parseFloat(precio.precioVta || '0') * dolar).toFixed(2),
        })),
      })),
    };
  }
}
