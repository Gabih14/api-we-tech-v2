import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  ) {}

  async create(
    createStkExistenciaDto: CreateStkExistenciaDto,
  ): Promise<StkExistencia> {
    const existencia = this.stkExistenciaRepository.create(
      createStkExistenciaDto,
    );
    return await this.stkExistenciaRepository.save(existencia);
  }

  async findAll(): Promise<StkExistencia[]> {
    return await this.stkExistenciaRepository.find();
  }

  async findOne(item: string, deposito: string): Promise<StkExistencia> {
    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) {
      throw new NotFoundException(
        `Existencia no encontrada para item: ${item} y deposito: ${deposito}`,
      );
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

  async reservarStock(
    item: string,
    cantidad: number,
    depositoPreferido?: string,
  ): Promise<string> {
    // 🚚 Items de envío (ENV-*) no requieren validación de depósito
    if (item.startsWith('ENV')) {
      return 'ENV'; // Retornar depósito virtual para items de envío
    }

    // Si se especifica depósito, usar lógica actual
    if (depositoPreferido) {
      const existencia = await this.stkExistenciaRepository.findOne({
        where: { item, deposito: depositoPreferido },
      });
      if (!existencia) {
        throw new NotFoundException(
          `Stock no encontrado para ${item} en ${depositoPreferido}`,
        );
      }

      const comprometido = Number(existencia.comprometido || 0);
      const cantidadActual = Number(existencia.cantidad || 0);
      const disponible = cantidadActual - comprometido;

      if (disponible < cantidad) {
        throw new ConflictException(
          `Stock insuficiente para ${item} en ${depositoPreferido}. Disponible: ${disponible}, Solicitado: ${cantidad}`,
        );
      }

      existencia.comprometido = (comprometido + cantidad).toString();
      await this.stkExistenciaRepository.save(existencia);
      return depositoPreferido;
    }

    // Sin depósito especificado: buscar en todos
    const existencias = await this.stkExistenciaRepository.find({
      where: { item },
    });

    if (!existencias.length) {
      throw new NotFoundException(
        `Item ${item} no encontrado en ningún depósito`,
      );
    }

    // Calcular disponible por depósito y ordenar
    const conDisponibilidad = existencias
      .map((e) => ({
        existencia: e,
        disponible: Number(e.cantidad || 0) - Number(e.comprometido || 0),
      }))
      .filter((e) => e.disponible > 0)
      .sort((a, b) => b.disponible - a.disponible);

    if (!conDisponibilidad.length) {
      throw new ConflictException(
        `Sin stock disponible para ${item} en ningún depósito`,
      );
    }

    // Reservar del depósito con más stock
    const { existencia, disponible } = conDisponibilidad[0];

    if (disponible < cantidad) {
      throw new ConflictException(
        `Stock insuficiente para ${item}. Disponible total: ${disponible}, Solicitado: ${cantidad}`,
      );
    }

    const comprometido = Number(existencia.comprometido || 0);
    existencia.comprometido = (comprometido + cantidad).toString();
    await this.stkExistenciaRepository.save(existencia);

    return existencia.deposito; // 👈 Retornar el depósito usado
  }

  async confirmarStock(
    item: string,
    cantidad: number,
    deposito?: string,
  ): Promise<string> {
    // 🚚 Items de envío (ENV-*) no requieren confirmación de stock
    if (item.startsWith('ENV')) {
      return 'ENV';
    }

    let existencia: StkExistencia | null;

    if (deposito) {
      // Depósito específico
      existencia = await this.stkExistenciaRepository.findOne({
        where: { item, deposito },
      });
    } else {
      // Buscar depósito con stock comprometido >= cantidad
      const existencias = await this.stkExistenciaRepository.find({
        where: { item },
      });
      existencia =
        existencias
          .filter((e) => Number(e.comprometido || 0) >= cantidad)
          .sort(
            (a, b) => Number(b.comprometido || 0) - Number(a.comprometido || 0),
          )[0] || null;
    }

    if (!existencia) throw new NotFoundException('Stock no encontrado');

    const comprometido = Number(existencia.comprometido || 0);
    const cantidadActual = Number(existencia.cantidad || 0);

    if (comprometido < cantidad || cantidadActual < cantidad)
      throw new ConflictException('Stock insuficiente');

    existencia.comprometido = (comprometido - cantidad).toString();
    existencia.cantidad = (cantidadActual - cantidad).toString();

    await this.stkExistenciaRepository.save(existencia);
    return existencia.deposito;
  }

  /**
   * Compensa una confirmacion cuando falla una operacion critica posterior.
   * Repone tanto la existencia como la reserva que habia antes de confirmar.
   */
  async restaurarStockConfirmado(
    item: string,
    cantidad: number,
    deposito: string,
  ): Promise<void> {
    if (item.startsWith('ENV') || deposito === 'ENV') return;

    const existencia = await this.stkExistenciaRepository.findOne({
      where: { item, deposito },
    });
    if (!existencia) {
      throw new NotFoundException(
        `No se pudo restaurar stock para ${item} en ${deposito}`,
      );
    }

    existencia.cantidad = (
      Number(existencia.cantidad || 0) + cantidad
    ).toString();
    existencia.comprometido = (
      Number(existencia.comprometido || 0) + cantidad
    ).toString();

    await this.stkExistenciaRepository.save(existencia);
  }

  async liberarStock(item: string, cantidad: number, deposito?: string) {
    // 🚚 Items de envío (ENV-*) no requieren liberación de stock
    if (item.startsWith('ENV')) {
      return; // Sin operación para items de envío
    }

    let existencia: StkExistencia | null;

    if (deposito) {
      // Depósito específico
      existencia = await this.stkExistenciaRepository.findOne({
        where: { item, deposito },
      });
    } else {
      // Buscar depósito con stock comprometido
      const existencias = await this.stkExistenciaRepository.find({
        where: { item },
      });
      existencia =
        existencias
          .filter((e) => Number(e.comprometido || 0) > 0)
          .sort(
            (a, b) => Number(b.comprometido || 0) - Number(a.comprometido || 0),
          )[0] || null;
    }

    if (!existencia) throw new NotFoundException('Stock no encontrado');

    const comprometido = Number(existencia.comprometido || 0);
    existencia.comprometido = Math.max(0, comprometido - cantidad).toString();

    await this.stkExistenciaRepository.save(existencia);
  }
}
