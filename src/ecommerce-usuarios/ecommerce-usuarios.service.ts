import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClerkService } from '../auth/clerk.service';
import {
  EcommerceUsuario,
  EstadoMayorista,
} from './entities/ecommerce-usuario.entity';
import { ListEcommerceUsuariosDto } from './dto/list-ecommerce-usuarios.dto';

export interface EcommerceUsuariosPage {
  data: Array<
    EcommerceUsuario & {
      email: string | null;
      nombre: string | null;
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EcommerceUsuariosService {
  private readonly logger = new Logger(EcommerceUsuariosService.name);

  constructor(
    @InjectRepository(EcommerceUsuario, 'back')
    private readonly repository: Repository<EcommerceUsuario>,
    private readonly clerk: ClerkService,
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

    let identities = new Map<
      string,
      { email: string | null; nombre: string | null }
    >();

    if (data.length) {
      try {
        const clerkUsers = await this.clerk.client.users.getUserList({
          userId: data.map(({ clerkUserId }) => clerkUserId),
          limit: data.length,
        });

        identities = new Map(
          clerkUsers.data.map((user) => [
            user.id,
            {
              email:
                user.emailAddresses.find(
                  ({ id }) => id === user.primaryEmailAddressId,
                )?.emailAddress ?? null,
              nombre:
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                null,
            },
          ]),
        );
      } catch {
        this.logger.warn('No se pudieron obtener las identidades desde Clerk');
      }
    }

    return {
      data: data.map((user) => ({
        ...user,
        ...(identities.get(user.clerkUserId) ?? { email: null, nombre: null }),
      })),
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
