import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StkExistencia } from '../stk-existencia/entities/stk-existencia.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { CreateEsperaDto } from './dto/create-espera.dto';
import { DmEspera, DmEsperaTipo } from './entities/dm-espera.entity';

export interface EsperaResponse {
  id: number;
  tipo: DmEsperaTipo;
  prod: string;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_tel: string | null;
  cantidad: number;
  nota: string | null;
  avisado: number;
  avisado_en: Date | null;
  usuario: string | null;
  creado_en: Date;
}

@Injectable()
export class EsperaService {
  constructor(
    @InjectRepository(DmEspera)
    private readonly esperaRepository: Repository<DmEspera>,
    @InjectRepository(StkItem)
    private readonly stkItemRepository: Repository<StkItem>,
    @InjectRepository(StkExistencia)
    private readonly stkExistenciaRepository: Repository<StkExistencia>,
  ) {}

  async crear(dto: CreateEsperaDto): Promise<EsperaResponse> {
    const productoId = dto.producto_id.trim();
    const item = await this.stkItemRepository.findOne({
      where: { id: productoId },
      select: {
        id: true,
        descripcion: true,
        grupo: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    }

    const disponible = await this.obtenerStockDisponible(item.id);

    if (disponible > 0) {
      throw new ConflictException(
        `El producto ${item.id} tiene stock disponible`,
      );
    }

    const prod = this.normalizarProd(item);
    const existente = await this.buscarPendienteExistente(prod, dto);
    const data = {
      tipo: this.derivarTipo(item.grupo),
      prod,
      clienteId: this.nullIfBlank(dto.cliente_id),
      clienteNombre: dto.cliente_nombre.trim(),
      clienteTel: this.nullIfBlank(dto.cliente_tel),
      cantidad: dto.cantidad ?? 1,
      nota: this.nullIfBlank(dto.nota),
      avisado: 0,
      avisadoEn: null,
      usuario: 'web',
    };

    const espera = existente
      ? await this.esperaRepository.save({ ...existente, ...data })
      : await this.esperaRepository.save(this.esperaRepository.create(data));

    return this.toResponse(espera);
  }

  private async obtenerStockDisponible(itemId: string): Promise<number> {
    const existencias = await this.stkExistenciaRepository.find({
      where: { item: itemId },
      select: {
        item: true,
        deposito: true,
        cantidad: true,
        comprometido: true,
      },
    });

    return existencias.reduce((total, existencia) => {
      const cantidad = Number(existencia.cantidad ?? 0);
      return total + cantidad;
    }, 0);
  }

  private async buscarPendienteExistente(
    prod: string,
    dto: CreateEsperaDto,
  ): Promise<DmEspera | null> {
    const clienteId = this.nullIfBlank(dto.cliente_id);

    if (clienteId) {
      return this.esperaRepository.findOne({
        where: { prod, clienteId, avisado: 0 },
      });
    }

    const clienteTel = this.nullIfBlank(dto.cliente_tel);

    if (clienteTel) {
      return this.esperaRepository.findOne({
        where: { prod, clienteTel, avisado: 0 },
      });
    }

    return null;
  }

  private derivarTipo(grupo: string | null): DmEsperaTipo {
    const normalized = grupo?.trim().toUpperCase();

    if (normalized === 'FILAMENTOS') {
      return 'filamento';
    }

    if (normalized === 'IMPRESORAS') {
      return 'impresora';
    }

    return 'repuesto';
  }

  private normalizarProd(item: StkItem): string {
    const descripcion = item.descripcion?.trim();
    return descripcion || item.id;
  }

  private nullIfBlank(value: string | undefined | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private toResponse(espera: DmEspera): EsperaResponse {
    return {
      id: espera.id,
      tipo: espera.tipo,
      prod: espera.prod,
      cliente_id: espera.clienteId,
      cliente_nombre: espera.clienteNombre,
      cliente_tel: espera.clienteTel,
      cantidad: espera.cantidad,
      nota: espera.nota,
      avisado: espera.avisado,
      avisado_en: espera.avisadoEn,
      usuario: espera.usuario,
      creado_en: espera.creadoEn,
    };
  }
}
