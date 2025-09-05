import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkPrecio } from './entities/stk-precio.entity';
import { CreateStkPrecioDto } from './dto/create-stk-precio.dto';

@Injectable()
export class StkPrecioService {
  constructor(
    @InjectRepository(StkPrecio)
    private readonly stkPrecioRepository: Repository<StkPrecio>,
  ) {}

  async create(createStkPrecioDto: CreateStkPrecioDto): Promise<StkPrecio> {
    const precio = this.stkPrecioRepository.create(createStkPrecioDto);
    return await this.stkPrecioRepository.save(precio);
  }

  async findAll(): Promise<any[]> {
    const precios = await this.stkPrecioRepository.find({
      relations: ['item2', 'moneda'],
    });
  
    return precios.map((p) => {
      const precioVta = parseFloat(p.precioVta || '0');
      const cotizacion = parseFloat(p.moneda?.cotizacion || '1');
  
      return {
        ...p,
        precioVtaCotizado:
          !isNaN(precioVta) && !isNaN(cotizacion)
            ? (precioVta * cotizacion).toFixed(2) // Multiplica por la cotización de la moneda del precio
            : null,
      };
    });
  }
  
  async findOne(lista: string, item: string): Promise<any> {
    const precio = await this.stkPrecioRepository.findOne({
      where: { lista, item },
      relations: ['item2', 'moneda'],
    });
  
    if (!precio) return null;
  
    const precioVta = parseFloat(precio.precioVta || '0');
    const cotizacion = parseFloat(precio.moneda?.cotizacion || '1');
  
    return {
      ...precio,
      precioVtaCotizado:
        !isNaN(precioVta) && !isNaN(cotizacion)
          ? (precioVta * cotizacion).toFixed(2) // Multiplica por la cotización de la moneda del precio
          : null,
    };
  }

  async getCotizacionDolar(): Promise<number> {
    const dolar = await this.stkPrecioRepository.query(
      `SELECT cotizacion FROM bas_moneda WHERE id = 'DOL'`
    );
    return parseFloat(dolar[0]?.cotizacion || '1');
  }
  
}
