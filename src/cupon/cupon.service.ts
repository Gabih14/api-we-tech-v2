import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCuponDto } from './dto/create-cupon.dto';
import { UpdateCuponDto } from './dto/update-cupon.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Cupon,
  CuponCategoriaAplicable,
} from './entities/cupon.entity';
import { Repository } from 'typeorm';
import { CuponUso } from 'src/cupon_uso/entities/cupon_uso.entity';
import { CreateCuponUsoDto } from 'src/cupon_uso/dto/create-cupon_uso.dto';

export interface CuponDescuentoResolucion {
  codigoCupon: string;
  modalidadSolicitada: string;
  modalidadAplicada: 'TARJETA' | 'CUENTA' | 'FALLBACK_TARJETA';
  porcentajeAplicado: number;
  categoriaAplicable: CuponCategoriaAplicable | null;
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
      cuitHabilitado: this.normalizarCuitOpcional(
        crearCuponDto.cuitHabilitado ?? crearCuponDto.cuit_habilitado,
      ),
      categoriaAplicable: this.normalizarCategoriaAplicable(
        crearCuponDto.categoriaAplicable ??
          crearCuponDto.categoria_aplicable,
      ),
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

  async actualizar(
    id: string,
    actualizarCuponDto: UpdateCuponDto,
  ): Promise<Cupon> {
    if (actualizarCuponDto.id && actualizarCuponDto.id !== id) {
      throw new BadRequestException('No se puede cambiar el id del cupón');
    }

    const cupon = await this.buscarPorIdIncluyendoInactivos(id);
    const descuentosNormalizados = this.normalizarDescuentosParaEdicion(
      actualizarCuponDto,
      cupon,
    );
    const {
      id: _id,
      max_usos_por_cuit,
      cuitHabilitado,
      cuit_habilitado,
      categoriaAplicable,
      categoria_aplicable,
      ...datosActualizables
    } = actualizarCuponDto;

    Object.assign(cupon, {
      ...datosActualizables,
      ...descuentosNormalizados,
    });

    if (max_usos_por_cuit !== undefined) {
      cupon.maxUsosPorCuit = max_usos_por_cuit;
    }

    if (
      cuitHabilitado !== undefined ||
      cuit_habilitado !== undefined
    ) {
      cupon.cuitHabilitado = this.normalizarCuitOpcional(
        cuitHabilitado ?? cuit_habilitado,
      );
    }

    if (
      categoriaAplicable !== undefined ||
      categoria_aplicable !== undefined
    ) {
      cupon.categoriaAplicable = this.normalizarCategoriaAplicable(
        categoriaAplicable ?? categoria_aplicable,
      );
    }

    return await this.cuponRepository.save(cupon);
  }

  private async buscarPorIdIncluyendoInactivos(id: string): Promise<Cupon> {
    const cupon = await this.cuponRepository.findOne({
      where: { id },
      relations: ['usos'],
    });

    if (!cupon) {
      throw new NotFoundException(`Cupón ${id} no encontrado`);
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
        categoriaAplicable: cupon.categoriaAplicable ?? null,
      };
    }

    if (modalidadNormalizada === 'TARJETA') {
      return {
        codigoCupon,
        modalidadSolicitada: modalidadNormalizada,
        modalidadAplicada: 'TARJETA',
        porcentajeAplicado: porcentajeTarjeta,
        categoriaAplicable: cupon.categoriaAplicable ?? null,
      };
    }

    return {
      codigoCupon,
      modalidadSolicitada: modalidadNormalizada,
      modalidadAplicada: 'FALLBACK_TARJETA',
      porcentajeAplicado: porcentajeTarjeta,
      categoriaAplicable: cupon.categoriaAplicable ?? null,
    };
  }

  // Validar y usar cupón
  async usarCupon(usarCuponDto: CreateCuponUsoDto): Promise<CuponUso> {
    await this.validarUsoCupon(usarCuponDto);

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

    this.validarCuitHabilitado(cupon, cuitNormalizado);

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

  async validarUsoCupon(usarCuponDto: CreateCuponUsoDto): Promise<void> {
    const cuitNormalizado = this.normalizarCuit(usarCuponDto.cuit);

    if (usarCuponDto.pedido_id) {
      const usoExistente = await this.cuponUsoRepository.findOne({
        where: {
          cuponId: usarCuponDto.cupon_id,
          pedidoId: usarCuponDto.pedido_id,
        },
      });

      if (usoExistente) {
        return;
      }
    }

    const cupon = await this.buscarPorId(usarCuponDto.cupon_id);

    this.validarCuitHabilitado(cupon, cuitNormalizado);

    if (cupon.fechaDesde && cupon.fechaDesde > new Date()) {
      throw new BadRequestException('Cupon aun no esta vigente');
    }

    if (cupon.fechaHasta && cupon.fechaHasta < new Date()) {
      throw new BadRequestException('Cupon ha expirado');
    }

    if (cupon.max_usos) {
      const usosTotales = await this.cuponUsoRepository.count({
        where: { cuponId: cupon.id },
      });

      if (usosTotales >= cupon.max_usos) {
        throw new BadRequestException('Cupon ha alcanzado su limite de usos');
      }
    }

    if (cupon.maxUsosPorCuit) {
      const usosPorCuit = await this.contarUsosDelCuit(
        cupon.id,
        cuitNormalizado,
      );

      if (usosPorCuit >= cupon.maxUsosPorCuit) {
        throw new BadRequestException(
          'Has alcanzado el limite de usos para este cupon',
        );
      }
    }
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

  private normalizarDescuentosParaEdicion(
    actualizarCuponDto: UpdateCuponDto,
    cupon: Cupon,
  ) {
    const descuentoFueEnviado =
      actualizarCuponDto.porcentajeDescuento !== undefined ||
      actualizarCuponDto.porcentajeDescuentoTarjeta !== undefined ||
      actualizarCuponDto.porcentajeDescuentoTransferencia !== undefined;

    if (!descuentoFueEnviado) {
      return {};
    }

    const legacy = this.toNumber(actualizarCuponDto.porcentajeDescuento);
    const tarjeta =
      actualizarCuponDto.porcentajeDescuentoTarjeta !== undefined
        ? this.toNumber(actualizarCuponDto.porcentajeDescuentoTarjeta)
        : (legacy ?? this.toNumber(cupon.porcentajeDescuentoTarjeta));
    const transferencia =
      actualizarCuponDto.porcentajeDescuentoTransferencia !== undefined
        ? this.toNumber(actualizarCuponDto.porcentajeDescuentoTransferencia)
        : (legacy ?? this.toNumber(cupon.porcentajeDescuentoTransferencia));
    const porcentajeDescuento = legacy ?? tarjeta ?? this.requerirValor();
    const porcentajeDescuentoTarjeta = tarjeta ?? this.requerirValor();
    const porcentajeDescuentoTransferencia =
      transferencia ?? this.requerirValor();

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

  private normalizarCuitOpcional(cuit?: string | null): string | null {
    if (cuit === null || cuit === undefined) {
      return null;
    }

    const cuitNormalizado = this.normalizarCuit(cuit);
    return cuitNormalizado || null;
  }

  private normalizarCategoriaAplicable(
    categoria?: string | null,
  ): CuponCategoriaAplicable | null {
    const normalizada = categoria?.trim().toLowerCase();

    if (!normalizada || normalizada === 'general') {
      return null;
    }

    if (
      normalizada === 'filamento' ||
      normalizada === 'impresora' ||
      normalizada === 'repuesto'
    ) {
      return normalizada;
    }

    throw new BadRequestException(
      'categoriaAplicable debe ser general, filamento, impresora o repuesto',
    );
  }

  private validarCuitHabilitado(
    cupon: Cupon,
    cuitNormalizado: string,
  ): void {
    if (!cupon.cuitHabilitado) {
      return;
    }

    if (this.normalizarCuit(cupon.cuitHabilitado) !== cuitNormalizado) {
      throw new BadRequestException(
        'Cupon valido solo para el CUIT habilitado',
      );
    }
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
