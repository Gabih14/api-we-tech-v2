import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EcommerceUsuario,
  EstadoMayorista,
} from './entities/ecommerce-usuario.entity';

@Injectable()
export class EcommerceUsuariosService {
  constructor(
    @InjectRepository(EcommerceUsuario, 'back')
    private readonly repository: Repository<EcommerceUsuario>,
  ) {}

  findByClerkUserId(clerkUserId: string): Promise<EcommerceUsuario | null> {
    return this.repository.findOne({ where: { clerkUserId } });
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
