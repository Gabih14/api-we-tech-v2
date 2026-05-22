import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCuponDto } from './dto/create-cupon.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cupon } from './entities/cupon.entity';
import { Repository } from 'typeorm';
import { CuponUso } from 'src/cupon_uso/entities/cupon_uso.entity';
import { CreateCuponUsoDto } from 'src/cupon_uso/dto/create-cupon_uso.dto';

export interface CuponDescuentoResolucion {
  codigoCupon: string;
  modalidadSolicitada: string;
  modalidadAplicada: 'TARJETA' | 'CUENTA' | 'FALLBACK_TARJETA';
  porcentajeAplicado: number;
}

export type CuponConResumenUsos = Cupon & {
  totalUsos: number;
  ultimoUso: Date | null;
};

@Injectable()
export class CuponService {
  constructor(
    @InjectRepository(Cupon, 'back')
    private cuponRepository: Repository<Cupon>,
    @InjectRepository(CuponUso, 'back')
    private cuponUsoRepository: Repository<CuponUso>,
  ) {}

  // Crear nuevo cupón
  async crear(crearCuponDto: CreateCuponDto): Promise<Cupon> {
    const cuponExistente = await this.cuponRepository.findOne({
      where: { id: crearCuponDto.id },
    });

    if (cuponExistente) {
      throw new BadRequestException(`El cupón ${crearCuponDto.id} ya existe`);
    }

    const descuentosNormalizados = this.normalizarDescuentos(crearCuponDto);
    const cupon = this.cuponRepository.create({
      ...crearCuponDto,
      ...descuentosNormalizados,
      maxUsosPorCuit:
        crearCuponDto.maxUsosPorCuit ?? crearCuponDto.max_usos_por_cuit,
    });

    return await this.cuponRepository.save(cupon);
  }

  // Buscar cupón por ID
  async buscarPorId(id: string): Promise<Cupon> {
    const cupon = await this.cuponRepository.findOne({
      where: { id, activo: true },
      relations: ['usos'],
    });

    if (!cupon) {
      throw new NotFoundException(`Cupón ${id} no encontrado o inactivo`);
    }

    return cupon;
  }

  async resolverPorcentajePorModalidad(
    codigoCupon: string,
    modalidad: string,
  ): Promise<CuponDescuentoResolucion> {
    const cupon = await this.buscarPorId(codigoCupon);

    const porcentajeTarjeta = this.resolverValorCupon(
      cupon.porcentajeDescuentoTarjeta,
      cupon.porcentajeDescuento,
    );
    const porcentajeTransferencia = this.resolverValorCupon(
      cupon.porcentajeDescuentoTransferencia,
      cupon.porcentajeDescuento,
    );

    const modalidadNormalizada = (modalidad ?? '').toUpperCase();

    if (modalidadNormalizada === 'CUENTA') {
      return {
        codigoCupon,
        modalidadSolicitada: modalidadNormalizada,
        modalidadAplicada: 'CUENTA',
        porcentajeAplicado: porcentajeTransferencia,
      };
    }

    if (modalidadNormalizada === 'TARJETA') {
      return {
        codigoCupon,
        modalidadSolicitada: modalidadNormalizada,
        modalidadAplicada: 'TARJETA',
        porcentajeAplicado: porcentajeTarjeta,
      };
    }

    return {
      codigoCupon,
      modalidadSolicitada: modalidadNormalizada,
      modalidadAplicada: 'FALLBACK_TARJETA',
      porcentajeAplicado: porcentajeTarjeta,
    };
  }

  // Validar y usar cupón
  async usarCupon(usarCuponDto: CreateCuponUsoDto): Promise<CuponUso> {
    const cuitNormalizado = this.normalizarCuit(usarCuponDto.cuit);

    if (usarCuponDto.pedido_id) {
      const usoExistente = await this.cuponUsoRepository.findOne({
        where: {
          cuponId: usarCuponDto.cupon_id,
          pedidoId: usarCuponDto.pedido_id,
        },
      });

      if (usoExistente) {
        return usoExistente;
      }
    }

    const cupon = await this.buscarPorId(usarCuponDto.cupon_id);

    // Validar fechas
    if (cupon.fechaDesde && cupon.fechaDesde > new Date()) {
      throw new BadRequestException('Cupón aún no está vigente');
    }

    if (cupon.fechaHasta && cupon.fechaHasta < new Date()) {
      throw new BadRequestException('Cupón ha expirado');
    }

    // Validar usos totales
    if (cupon.max_usos) {
      const usosTotales = await this.cuponUsoRepository.count({
        where: { cuponId: cupon.id },
      });

      if (usosTotales >= cupon.max_usos) {
        throw new BadRequestException('Cupón ha alcanzado su límite de usos');
      }
    }

    // Validar usos por CUIT
    if (cupon.maxUsosPorCuit) {
      const usosPorCuit = await this.contarUsosDelCuit(
        cupon.id,
        cuitNormalizado,
      );

      if (usosPorCuit >= cupon.maxUsosPorCuit) {
        throw new BadRequestException(
          'Has alcanzado el límite de usos para este cupón',
        );
      }
    }

    // Registrar uso
    const cuponUso = this.cuponUsoRepository.create({
      cuponId: cupon.id,
      cuit: cuitNormalizado,
      pedidoId: usarCuponDto.pedido_id,
      usadoEn: new Date(),
    });

    return await this.cuponUsoRepository.save(cuponUso);
  }

  // Listar todos los cupones activos
  async listarActivos(): Promise<CuponConResumenUsos[]> {
    const { entities, raw } = await this.cuponRepository
      .createQueryBuilder('cupon')
      .loadRelationCountAndMap('cupon.totalUsos', 'cupon.usos')
      .addSelect((subQuery) => {
        return subQuery
          .select('MAX(cuponUso.usado_en)')
          .from(CuponUso, 'cuponUso')
          .where('cuponUso.cupon_id = cupon.id');
      }, 'ultimoUso')
      .where('cupon.activo = :activo', { activo: true })
      .orderBy('cupon.fechaDesde', 'DESC')
      .getRawAndEntities();

    return entities.map((cupon, index) =>
      Object.assign(cupon, {
        ultimoUso: raw[index]?.ultimoUso
          ? new Date(raw[index].ultimoUso)
          : null,
      }),
    ) as CuponConResumenUsos[];
  }

  // Desactivar cupón
  async desactivar(id: string): Promise<Cupon> {
    const cupon = await this.buscarPorId(id);
    cupon.activo = false;
    return await this.cuponRepository.save(cupon);
  }

  // Obtener estadísticas de uso
  async obtenerEstadisticas(id: string): Promise<any> {
    const cupon = await this.buscarPorId(id);

    const usos = await this.cuponUsoRepository.find({
      where: { cuponId: id },
    });

    return {
      cupon,
      totalUsos: usos.length,
      usosPorCuit: this.contarUsosPorCuit(usos),
      ultimosUsos: usos.slice(-5).reverse(),
    };
  }

  private normalizarDescuentos(crearCuponDto: CreateCuponDto) {
    const legacy = this.toNumber(crearCuponDto.porcentajeDescuento);
    const tarjeta = this.toNumber(crearCuponDto.porcentajeDescuentoTarjeta);
    const transferencia = this.toNumber(
      crearCuponDto.porcentajeDescuentoTransferencia,
    );
    const tieneDescuentoPorMetodo = tarjeta !== null || transferencia !== null;

    const porcentajeDescuentoTarjeta =
      tarjeta ?? legacy ?? (tieneDescuentoPorMetodo ? 0 : this.requerirValor());
    const porcentajeDescuentoTransferencia =
      transferencia ??
      legacy ??
      (tieneDescuentoPorMetodo ? 0 : this.requerirValor());
    const porcentajeDescuento = legacy ?? porcentajeDescuentoTarjeta;

    this.validarRangoPorcentaje(
      porcentajeDescuentoTarjeta,
      'porcentajeDescuentoTarjeta',
    );
    this.validarRangoPorcentaje(
      porcentajeDescuentoTransferencia,
      'porcentajeDescuentoTransferencia',
    );

    return {
      porcentajeDescuento,
      porcentajeDescuentoTarjeta,
      porcentajeDescuentoTransferencia,
    };
  }

  private resolverValorCupon(
    valorPrincipal: unknown,
    valorLegacy: unknown,
  ): number {
    const principal = this.toNumber(valorPrincipal);
    if (principal !== null) {
      return principal;
    }

    const legacy = this.toNumber(valorLegacy);
    if (legacy !== null) {
      return legacy;
    }

    throw new BadRequestException(
      'El cupón no tiene un porcentaje de descuento válido configurado',
    );
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Number(parsed.toFixed(2));
  }

  private validarRangoPorcentaje(value: number, field: string): void {
    if (value < 0 || value > 100) {
      throw new BadRequestException(`${field} debe estar entre 0 y 100`);
    }
  }

  private normalizarCuit(cuit: string): string {
    const digitos = cuit.replace(/\D/g, '');
    return digitos || cuit.trim();
  }

  private async contarUsosDelCuit(
    cuponId: string,
    cuitNormalizado: string,
  ): Promise<number> {
    return this.cuponUsoRepository
      .createQueryBuilder('cuponUso')
      .where('cuponUso.cupon_id = :cuponId', { cuponId })
      .andWhere(
        `REPLACE(REPLACE(REPLACE(REPLACE(cuponUso.cuit, '-', ''), '.', ''), '/', ''), ' ', '') = :cuit`,
        { cuit: cuitNormalizado },
      )
      .getCount();
  }

  private requerirValor(): never {
    throw new BadRequestException(
      'Debes enviar porcentajeDescuentoTarjeta, porcentajeDescuentoTransferencia o porcentajeDescuento legacy',
    );
  }

  private contarUsosPorCuit(usos: CuponUso[]): Record<string, number> {
    return usos.reduce((acc, uso) => {
      acc[uso.cuit] = (acc[uso.cuit] || 0) + 1;
      return acc;
    }, {});
  }
}
