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

    const cupon = this.cuponRepository.create(crearCuponDto);
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

  // Validar y usar cupón
  async usarCupon(usarCuponDto: CreateCuponUsoDto): Promise<CuponUso> {
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
      const usosPorCuit = await this.cuponUsoRepository.count({
        where: {
          cuponId: cupon.id,
          cuit: usarCuponDto.cuit,
        },
      });

      if (usosPorCuit >= cupon.maxUsosPorCuit) {
        throw new BadRequestException(
          'Has alcanzado el límite de usos para este cupón',
        );
      }
    }

    // Registrar uso
    const cuponUso = this.cuponUsoRepository.create({
      cuponId: cupon.id,
      cuit: usarCuponDto.cuit,
      pedidoId: usarCuponDto.pedido_id,
      usadoEn: new Date(),
    });

    return await this.cuponUsoRepository.save(cuponUso);
  }

  // Listar todos los cupones activos
  async listarActivos(): Promise<Cupon[]> {
    return await this.cuponRepository.find({
      where: { activo: true },
      order: { fechaDesde: 'DESC' },
    });
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

  private contarUsosPorCuit(usos: CuponUso[]): Record<string, number> {
    return usos.reduce((acc, uso) => {
      acc[uso.cuit] = (acc[uso.cuit] || 0) + 1;
      return acc;
    }, {});
  }
}
