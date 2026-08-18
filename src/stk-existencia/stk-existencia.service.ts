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

export interface StockSolicitud {
  item: string;
  cantidad: number;
  deposito?: string;
}

export interface StockSalida {
  deposito: string;
  cantidad: number;
}

export interface StockConfirmado {
  item: string;
  cantidad: number;
  depositoReserva: string;
  salidas: StockSalida[];
}

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
   * Confirma todas las reservas como una unica operacion. Las filas quedan
   * bloqueadas hasta validar y guardar el lote completo; si una linea falla,
   * la transaccion revierte cualquier cambio anterior.
   */
  async confirmarStockLote(
    solicitudes: StockSolicitud[],
  ): Promise<StockConfirmado[]> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    return this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const confirmaciones: Array<{
        existencia: StkExistencia;
        item: string;
        cantidad: number;
        depositoReserva: string;
        salidas: Array<{
          existencia: StkExistencia;
          deposito: string;
          cantidad: number;
        }>;
      }> = [];
      const virtuales: StockConfirmado[] = [];
      const compromisoPlanificado = new Map<StkExistencia, number>();
      const salidaPlanificada = new Map<StkExistencia, number>();

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) {
          virtuales.push({
            item: solicitud.item,
            cantidad: solicitud.cantidad,
            depositoReserva: 'ENV',
            salidas: [{ deposito: 'ENV', cantidad: solicitud.cantidad }],
          });
          continue;
        }

        const existencias = await repo.find({
          where: { item: solicitud.item },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existencias.length) {
          throw new NotFoundException(
            `Stock no encontrado para ${solicitud.item}${
              solicitud.deposito ? ` en ${solicitud.deposito}` : ''
            }`,
          );
        }

        const reservaPreferida = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : undefined;
        const compromisoDisponible = (row: StkExistencia) =>
          Number(row.comprometido || 0) - (compromisoPlanificado.get(row) ?? 0);
        const existencia =
          (reservaPreferida &&
          compromisoDisponible(reservaPreferida) >= solicitud.cantidad
            ? reservaPreferida
            : undefined) ??
          existencias
            .filter((row) => compromisoDisponible(row) >= solicitud.cantidad)
            .sort(
              (a, b) => compromisoDisponible(b) - compromisoDisponible(a),
            )[0];

        if (!existencia) {
          const compromisoMaximo = Math.max(
            0,
            ...existencias.map((row) => compromisoDisponible(row)),
          );
          throw new ConflictException(
            `Reserva insuficiente para ${solicitud.item}. Comprometido maximo: ${compromisoMaximo}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        const comprometido = compromisoDisponible(existencia);
        if (comprometido < solicitud.cantidad) {
          throw new ConflictException(
            `Reserva insuficiente para ${solicitud.item} en ${existencia.deposito}. Comprometido: ${comprometido}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        const obtenerStockUtilizable = (row: StkExistencia) => {
          const cantidadRestante =
            Number(row.cantidad || 0) - (salidaPlanificada.get(row) ?? 0);
          const compromisoRestante =
            Number(row.comprometido || 0) -
            (compromisoPlanificado.get(row) ?? 0) -
            (row === existencia ? solicitud.cantidad : 0);
          return Math.max(0, cantidadRestante - compromisoRestante);
        };
        const candidatosSalida = [...existencias].sort((a, b) => {
          if (a.deposito === existencia.deposito) return -1;
          if (b.deposito === existencia.deposito) return 1;
          return obtenerStockUtilizable(b) - obtenerStockUtilizable(a);
        });
        const salidas: Array<{
          existencia: StkExistencia;
          deposito: string;
          cantidad: number;
        }> = [];
        let cantidadPendiente = solicitud.cantidad;

        for (const candidato of candidatosSalida) {
          if (cantidadPendiente <= 0) break;

          const utilizable = obtenerStockUtilizable(candidato);
          const cantidadSalida = Math.min(utilizable, cantidadPendiente);
          if (cantidadSalida <= 0) continue;

          salidas.push({
            existencia: candidato,
            deposito: candidato.deposito,
            cantidad: cantidadSalida,
          });
          cantidadPendiente -= cantidadSalida;
        }

        if (cantidadPendiente > 0) {
          const stockUtilizable = solicitud.cantidad - cantidadPendiente;
          throw new ConflictException(
            `Stock fisico insuficiente para ${solicitud.item}. Utilizable entre depositos: ${stockUtilizable}, Solicitado: ${solicitud.cantidad}, Reserva en ${existencia.deposito}: ${comprometido}`,
          );
        }

        confirmaciones.push({
          existencia,
          item: solicitud.item,
          cantidad: solicitud.cantidad,
          depositoReserva: existencia.deposito,
          salidas,
        });
        compromisoPlanificado.set(
          existencia,
          (compromisoPlanificado.get(existencia) ?? 0) + solicitud.cantidad,
        );
        for (const salida of salidas) {
          salidaPlanificada.set(
            salida.existencia,
            (salidaPlanificada.get(salida.existencia) ?? 0) + salida.cantidad,
          );
        }
      }

      const existenciasModificadas = new Set<StkExistencia>();
      for (const confirmacion of confirmaciones) {
        const comprometido = Number(confirmacion.existencia.comprometido || 0);
        confirmacion.existencia.comprometido = (
          comprometido - confirmacion.cantidad
        ).toString();
        existenciasModificadas.add(confirmacion.existencia);

        for (const salida of confirmacion.salidas) {
          salida.existencia.cantidad = (
            Number(salida.existencia.cantidad || 0) - salida.cantidad
          ).toString();
          existenciasModificadas.add(salida.existencia);
        }
      }

      if (existenciasModificadas.size) {
        await repo.save([...existenciasModificadas]);
      }

      return [
        ...confirmaciones.map(
          ({ item, cantidad, depositoReserva, salidas }) => ({
            item,
            cantidad,
            depositoReserva,
            salidas: salidas.map(({ deposito, cantidad: salidaCantidad }) => ({
              deposito,
              cantidad: salidaCantidad,
            })),
          }),
        ),
        ...virtuales,
      ];
    });
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

  async restaurarStockConfirmadoLote(
    confirmaciones: StockConfirmado[],
  ): Promise<void> {
    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const existenciasRestauradas = new Set<StkExistencia>();

      for (const confirmacion of confirmaciones) {
        if (
          confirmacion.item.startsWith('ENV') ||
          confirmacion.depositoReserva === 'ENV'
        ) {
          continue;
        }

        const existencias = await repo.find({
          where: { item: confirmacion.item },
          lock: { mode: 'pessimistic_write' },
        });
        const existenciaReserva = existencias.find(
          (row) => row.deposito === confirmacion.depositoReserva,
        );
        if (!existenciaReserva) {
          throw new NotFoundException(
            `No se pudo restaurar la reserva de ${confirmacion.item} en ${confirmacion.depositoReserva}`,
          );
        }

        existenciaReserva.comprometido = (
          Number(existenciaReserva.comprometido || 0) + confirmacion.cantidad
        ).toString();
        existenciasRestauradas.add(existenciaReserva);

        for (const salida of confirmacion.salidas) {
          if (salida.deposito === 'ENV') continue;
          const existenciaSalida = existencias.find(
            (row) => row.deposito === salida.deposito,
          );
          if (!existenciaSalida) {
            throw new NotFoundException(
              `No se pudo restaurar la salida de ${confirmacion.item} en ${salida.deposito}`,
            );
          }

          existenciaSalida.cantidad = (
            Number(existenciaSalida.cantidad || 0) + salida.cantidad
          ).toString();
          existenciasRestauradas.add(existenciaSalida);
        }
      }

      if (existenciasRestauradas.size) {
        await repo.save([...existenciasRestauradas]);
      }
    });
  }

  private agruparSolicitudes(solicitudes: StockSolicitud[]): StockSolicitud[] {
    const agrupadas = new Map<string, StockSolicitud>();

    for (const solicitud of solicitudes) {
      const cantidad = Number(solicitud.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ConflictException(
          `Cantidad invalida para ${solicitud.item}: ${solicitud.cantidad}`,
        );
      }

      const key = `${solicitud.item}\u0000${solicitud.deposito ?? ''}`;
      const existente = agrupadas.get(key);
      if (existente) {
        existente.cantidad += cantidad;
      } else {
        agrupadas.set(key, { ...solicitud, cantidad });
      }
    }

    return [...agrupadas.values()].sort((a, b) => {
      const itemComparison = a.item.localeCompare(b.item);
      return (
        itemComparison || (a.deposito ?? '').localeCompare(b.deposito ?? '')
      );
    });
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

  /**
   * Libera todas las reservas de un pedido de forma atomica. Primero valida
   * el lote completo y bloquea las existencias involucradas; si una reserva
   * no existe o es insuficiente, no modifica ninguna fila.
   */
  async liberarStockLote(solicitudes: StockSolicitud[]): Promise<void> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const liberaciones: Array<{
        existencia: StkExistencia;
        cantidad: number;
      }> = [];

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) continue;

        const existencias = await repo.find({
          where: { item: solicitud.item },
          lock: { mode: 'pessimistic_write' },
        });

        if (!existencias.length) {
          throw new NotFoundException(
            `Stock no encontrado para ${solicitud.item}`,
          );
        }

        const existencia = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : existencias
              .filter(
                (row) => Number(row.comprometido || 0) >= solicitud.cantidad,
              )
              .sort(
                (a, b) =>
                  Number(b.comprometido || 0) - Number(a.comprometido || 0),
              )[0];

        if (!existencia) {
          throw new NotFoundException(
            `Reserva no encontrada para ${solicitud.item}${
              solicitud.deposito ? ` en ${solicitud.deposito}` : ''
            }`,
          );
        }

        const comprometido = Number(existencia.comprometido || 0);
        if (comprometido < solicitud.cantidad) {
          throw new ConflictException(
            `Reserva insuficiente para liberar ${solicitud.item} en ${existencia.deposito}. Comprometido: ${comprometido}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        liberaciones.push({ existencia, cantidad: solicitud.cantidad });
      }

      const modificadas = new Set<StkExistencia>();
      for (const liberacion of liberaciones) {
        liberacion.existencia.comprometido = (
          Number(liberacion.existencia.comprometido || 0) - liberacion.cantidad
        ).toString();
        modificadas.add(liberacion.existencia);
      }

      if (modificadas.size) {
        await repo.save([...modificadas]);
      }
    });
  }

  /**
   * Cancela una transferencia cuya existencia fisica ya fue descontada por
   * el comprobante del ERP. Repone cantidad y elimina la reserva en un unico
   * movimiento atomico.
   */
  async revertirReservaTransferenciaLote(
    solicitudes: StockSolicitud[],
  ): Promise<void> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const reversiones: Array<{
        existencia: StkExistencia;
        cantidad: number;
      }> = [];

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) continue;

        const existencias = await repo.find({
          where: { item: solicitud.item },
          lock: { mode: 'pessimistic_write' },
        });
        const existencia = solicitud.deposito
          ? existencias.find((row) => row.deposito === solicitud.deposito)
          : existencias
              .filter(
                (row) => Number(row.comprometido || 0) >= solicitud.cantidad,
              )
              .sort(
                (a, b) =>
                  Number(b.comprometido || 0) - Number(a.comprometido || 0),
              )[0];

        if (!existencia) {
          throw new NotFoundException(
            `Reserva de transferencia no encontrada para ${solicitud.item}`,
          );
        }

        const comprometido = Number(existencia.comprometido || 0);
        if (comprometido < solicitud.cantidad) {
          throw new ConflictException(
            `Reserva insuficiente para revertir ${solicitud.item} en ${existencia.deposito}. Comprometido: ${comprometido}, Solicitado: ${solicitud.cantidad}`,
          );
        }

        reversiones.push({ existencia, cantidad: solicitud.cantidad });
      }

      for (const reversion of reversiones) {
        reversion.existencia.cantidad = (
          Number(reversion.existencia.cantidad || 0) + reversion.cantidad
        ).toString();
        reversion.existencia.comprometido = (
          Number(reversion.existencia.comprometido || 0) - reversion.cantidad
        ).toString();
      }

      if (reversiones.length) {
        await repo.save(reversiones.map(({ existencia }) => existencia));
      }
    });
  }

  /** Restaura solo la reserva si falla el guardado posterior de la aprobacion. */
  async restaurarCompromisoLote(solicitudes: StockSolicitud[]): Promise<void> {
    const agrupadas = this.agruparSolicitudes(solicitudes);

    await this.stkExistenciaRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StkExistencia);
      const restauradas: StkExistencia[] = [];

      for (const solicitud of agrupadas) {
        if (solicitud.item.startsWith('ENV')) continue;

        const existencia = solicitud.deposito
          ? await repo.findOne({
              where: {
                item: solicitud.item,
                deposito: solicitud.deposito,
              },
              lock: { mode: 'pessimistic_write' },
            })
          : (
              await repo.find({
                where: { item: solicitud.item },
                lock: { mode: 'pessimistic_write' },
              })
            )[0];

        if (!existencia) {
          throw new NotFoundException(
            `Existencia no encontrada para restaurar compromiso de ${solicitud.item}`,
          );
        }

        existencia.comprometido = (
          Number(existencia.comprometido || 0) + solicitud.cantidad
        ).toString();
        restauradas.push(existencia);
      }

      if (restauradas.length) await repo.save(restauradas);
    });
  }
}
