import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkExistencia } from './entities/stk-existencia.entity';
import { CreateStkExistenciaDto } from './dto/create-stk-existencia.dto';
import { UpdateStkExistenciaDto } from './dto/update-stk-existencia.dto';

@Injectable()
export class StkExistenciaService {
  constructor(
    @InjectRepository(StkExistencia)
    private readonly stkExistenciaRepository: Repository<StkExistencia>,
  ) { }

  async create(createStkExistenciaDto: CreateStkExistenciaDto): Promise<StkExistencia> {
    const existencia = this.stkExistenciaRepository.create(createStkExistenciaDto);
    return await this.stkExistenciaRepository.save(existencia);
  }

  async findAll(): Promise<StkExistencia[]> {
    return await this.stkExistenciaRepository.find();
  }

  async findOne(item: string, deposito: string): Promise<StkExistencia> {
    const existencia = await this.stkExistenciaRepository.findOne({ where: { item, deposito } });
    if (!existencia) {
      throw new NotFoundException(`Existencia no encontrada para item: ${item} y deposito: ${deposito}`);
    }
    return existencia;
  }

  async update(
    item: string,
    deposito: string,
    updateStkExistenciaDto: UpdateStkExistenciaDto,
  ): Promise<StkExistencia> {
    const existencia = await this.findOne(item, deposito);
    Object.assign(existencia, updateStkExistenciaDto);
    return await this.stkExistenciaRepository.save(existencia);
  }

  async remove(item: string, deposito: string): Promise<void> {
    const existencia = await this.findOne(item, deposito);
    await this.stkExistenciaRepository.remove(existencia);
  }

  async reservarStock(item: string, cantidad: number, deposito: string) {
    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) throw new NotFoundException('Stock no encontrado');

    const comprometido = Number(existencia.comprometido || 0);
    const cantidadActual = Number(existencia.cantidad || 0);
    const disponible = cantidadActual - comprometido;

    // ✅ Validar stock disponible antes de reservar
    if (disponible < cantidad) {
      throw new ConflictException(
        `Stock insuficiente para ${item}. Disponible: ${disponible}, Solicitado: ${cantidad}`
      );
    }

    existencia.comprometido = (comprometido + cantidad).toString();

    await this.stkExistenciaRepository.save(existencia);
  }

  async confirmarStock(item: string, cantidad: number, deposito: string) {
    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) throw new NotFoundException('Stock no encontrado');

    const comprometido = Number(existencia.comprometido || 0);
    const cantidadActual = Number(existencia.cantidad || 0);

    if (comprometido < cantidad || cantidadActual < cantidad)
      throw new ConflictException('Stock insuficiente');

    existencia.comprometido = (comprometido - cantidad).toString();
    existencia.cantidad = (cantidadActual - cantidad).toString();

    await this.stkExistenciaRepository.save(existencia);
  }

  async liberarStock(item: string, cantidad: number, deposito: string) {
    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) throw new NotFoundException('Stock no encontrado');

    const comprometido = Number(existencia.comprometido || 0);
    existencia.comprometido = Math.max(0, comprometido - cantidad).toString();

    await this.stkExistenciaRepository.save(existencia);
  }

}
