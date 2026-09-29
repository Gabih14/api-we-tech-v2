import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EcommerceUsuario,
  EstadoMayorista,
} from './entities/ecommerce-usuario.entity';
import { ListEcommerceUsuariosDto } from './dto/list-ecommerce-usuarios.dto';

export interface EcommerceUsuariosPage {
  data: EcommerceUsuario[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EcommerceUsuariosService {
  constructor(
    @InjectRepository(EcommerceUsuario, 'back')
    private readonly repository: Repository<EcommerceUsuario>,
  ) {}

  findByClerkUserId(clerkUserId: string): Promise<EcommerceUsuario | null> {
    return this.repository.findOne({ where: { clerkUserId } });
  }

  async findAll(
    query: ListEcommerceUsuariosDto,
  ): Promise<EcommerceUsuariosPage> {
    const { page = 1, limit = 20, estado } = query;
    const [data, total] = await this.repository.findAndCount({
      where: estado ? { estadoMayorista: estado } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneById(id: number): Promise<EcommerceUsuario> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario ecommerce ${id} no encontrado`);
    }
    return user;
  }

  async updateEstadoMayorista(
    id: number,
    estadoMayorista: EstadoMayorista,
  ): Promise<EcommerceUsuario> {
    const user = await this.findOneById(id);

    user.estadoMayorista = estadoMayorista;
    return this.repository.save(user);
  }

  async findOrCreateByClerkUserId(
    clerkUserId: string,
  ): Promise<EcommerceUsuario> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(EcommerceUsuario)
      .values({
        clerkUserId,
        estadoMayorista: EstadoMayorista.NO_SOLICITADO,
      })
      .orIgnore()
      .updateEntity(false)
      .execute();

    const user = await this.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new Error('No se pudo recuperar el usuario ecommerce');
    }
    return user;
  }
}
