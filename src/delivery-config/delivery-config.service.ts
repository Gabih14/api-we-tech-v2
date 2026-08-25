import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { CreateDeliveryConfigDto } from './dto/create-delivery-config.dto';
import { UpdateDeliveryConfigDto } from './dto/update-delivery-config.dto';
import { DeliveryConfig } from './entities/delivery-config.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';

export interface DeliveryQuote {
  itemId: string;
  descripcion: string | null;
  lista: 'MINORISTA';
  moneda: string | null;
  precioVta: number;
  costoTotal: number;
  origen: 'env' | 'delivery_config';
  deliveryConfigId: number | null;
}

interface DeliveryConfigMatch {
  config: DeliveryConfig;
  specificity: number;
}

const ENV_ITEM_PATTERN = /^ENV-(\d+)K-GM-DELIVERY$/i;

@Injectable()
export class DeliveryConfigService {
  constructor(
    @InjectRepository(DeliveryConfig, 'back')
    private readonly deliveryConfigRepository: Repository<DeliveryConfig>,
    @InjectRepository(StkItem)
    private readonly stkItemRepository: Repository<StkItem>,
  ) {}

  async create(dto: CreateDeliveryConfigDto): Promise<DeliveryConfig> {
    await this.validarItem(dto.item);
    const config = this.deliveryConfigRepository.create(
      this.toEntityValues(dto),
    );

    return this.deliveryConfigRepository.save(config);
  }

  async findAll(): Promise<DeliveryConfig[]> {
    return this.deliveryConfigRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<DeliveryConfig> {
    const config = await this.deliveryConfigRepository.findOne({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(
        `Configuracion de delivery ${id} no encontrada`,
      );
    }

    return config;
  }

  async update(
    id: number,
    dto: UpdateDeliveryConfigDto,
  ): Promise<DeliveryConfig> {
    const config = await this.findOne(id);
    await this.validarItem(dto.item);
    Object.assign(config, this.toEntityValues(dto));

    return this.deliveryConfigRepository.save(config);
  }

  async remove(id: number): Promise<void> {
    const config = await this.findOne(id);
    await this.deliveryConfigRepository.remove(config);
  }

  async cotizarEnvio(
    distancia: number,
    provincia?: string,
    departamento?: string,
  ): Promise<DeliveryQuote> {
    this.validarDistancia(distancia);

    const itemEnv = await this.buscarItemEnvAplicable(distancia);
    if (itemEnv) {
      return this.crearCotizacion(itemEnv, 'env', null);
    }

    const config = await this.buscarConfigAplicable(
      distancia,
      provincia,
      departamento,
    );

    if (!config?.item) {
      throw new NotFoundException(
        'No hay un delivery disponible para la distancia y ubicacion indicadas',
      );
    }

    const item = await this.buscarItemConPrecio(config.item);
    if (!item) {
      throw new InternalServerErrorException(
        `La configuracion de delivery ${config.id} referencia un item inexistente o sin precio MINORISTA`,
      );
    }

    return this.crearCotizacion(item, 'delivery_config', config.id);
  }

  private async buscarItemEnvAplicable(
    distancia: number,
  ): Promise<StkItem | null> {
    const items = await this.stkItemRepository.find({
      where: { id: Like('ENV-%K-GM-DELIVERY') },
      relations: ['stkPrecios', 'stkPrecios.moneda'],
    });

    return (
      items
        .map((item) => ({
          item,
          kms: this.extraerKmsItemEnv(item.id),
        }))
        .filter(
          ({ item, kms }) =>
            kms !== null &&
            kms >= distancia &&
            this.obtenerPrecioMinorista(item) !== null,
        )
        .sort(
          (a, b) =>
            (a.kms ?? 0) - (b.kms ?? 0) || a.item.id.localeCompare(b.item.id),
        )[0]?.item ?? null
    );
  }

  private async buscarConfigAplicable(
    distancia: number,
    provincia?: string,
    departamento?: string,
  ): Promise<DeliveryConfig | null> {
    const configs = await this.deliveryConfigRepository.find({
      where: {
        activo: true,
        kms: MoreThanOrEqual(distancia),
        item: Not(IsNull()),
      },
    });
    const provinciaNormalizada = this.normalizarUbicacion(provincia);
    const departamentoNormalizado = this.normalizarUbicacion(departamento);

    return (
      configs
        .map((config): DeliveryConfigMatch | null => {
          const specificity = this.obtenerEspecificidad(
            config,
            provinciaNormalizada,
            departamentoNormalizado,
          );
          return specificity === null ? null : { config, specificity };
        })
        .filter((match): match is DeliveryConfigMatch => match !== null)
        .sort(
          (a, b) =>
            b.specificity - a.specificity ||
            Number(a.config.kms) - Number(b.config.kms) ||
            a.config.id - b.config.id,
        )[0]?.config ?? null
    );
  }

  private obtenerEspecificidad(
    config: DeliveryConfig,
    provincia: string,
    departamento: string,
  ): number | null {
    const configProvincia = this.normalizarUbicacion(config.provincia);
    const configDepartamento = this.normalizarUbicacion(config.departamento);

    if (configProvincia && configDepartamento) {
      return configProvincia === provincia &&
        configDepartamento === departamento
        ? 4
        : null;
    }
    if (configDepartamento) {
      return configDepartamento === departamento ? 3 : null;
    }
    if (configProvincia) {
      return configProvincia === provincia ? 2 : null;
    }
    return 1;
  }

  private async validarItem(itemId?: string | null): Promise<void> {
    if (itemId === undefined || itemId === null) return;

    const normalizedItemId = itemId.trim();
    if (!normalizedItemId.startsWith('ENV')) {
      throw new BadRequestException(
        'item debe ser un producto virtual de envio con prefijo ENV',
      );
    }

    const item = await this.buscarItemConPrecio(normalizedItemId);
    if (!item) {
      throw new BadRequestException(
        `El item ${normalizedItemId} no existe o no tiene precio MINORISTA`,
      );
    }
  }

  private async buscarItemConPrecio(itemId: string): Promise<StkItem | null> {
    const item = await this.stkItemRepository.findOne({
      where: { id: itemId },
      relations: ['stkPrecios', 'stkPrecios.moneda'],
    });
    return item && this.obtenerPrecioMinorista(item) !== null ? item : null;
  }

  private crearCotizacion(
    item: StkItem,
    origen: DeliveryQuote['origen'],
    deliveryConfigId: number | null,
  ): DeliveryQuote {
    const precio = this.obtenerPrecioMinorista(item);
    if (!precio) {
      throw new InternalServerErrorException(
        `Precio MINORISTA no disponible para ${item.id}`,
      );
    }
    const precioVta = Number(precio.precioVta);
    const cotizacion =
      precio.moneda?.id === 'DOL' ? Number(precio.moneda.cotizacion || 1) : 1;

    return {
      itemId: item.id,
      descripcion: item.descripcion,
      lista: 'MINORISTA',
      moneda: precio.moneda?.id ?? null,
      precioVta,
      costoTotal: Number((precioVta * cotizacion).toFixed(2)),
      origen,
      deliveryConfigId,
    };
  }

  private obtenerPrecioMinorista(item: StkItem) {
    const precio = item.stkPrecios?.find(
      (candidate) => candidate.lista === 'MINORISTA',
    );
    if (
      !precio ||
      precio.precioVta === null ||
      precio.precioVta === '' ||
      !Number.isFinite(Number(precio.precioVta)) ||
      Number(precio.precioVta) < 0
    ) {
      return null;
    }

    if (
      precio.moneda?.id === 'DOL' &&
      (!Number.isFinite(Number(precio.moneda.cotizacion)) ||
        Number(precio.moneda.cotizacion) <= 0)
    ) {
      return null;
    }
    return precio;
  }

  private extraerKmsItemEnv(itemId: string): number | null {
    const match = itemId.match(ENV_ITEM_PATTERN);
    return match ? Number(match[1]) : null;
  }

  private normalizarUbicacion(value?: string | null): string {
    return (value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-AR');
  }

  private validarDistancia(distancia: number): void {
    if (!Number.isFinite(distancia) || distancia < 0) {
      throw new BadRequestException(
        'distancia debe ser un numero mayor o igual a cero',
      );
    }
  }

  private toEntityValues(
    dto: CreateDeliveryConfigDto | UpdateDeliveryConfigDto,
  ): Partial<DeliveryConfig> {
    const values: Partial<DeliveryConfig> = {};

    if (dto.telefono !== undefined) values.telefono = dto.telefono.trim();
    if (dto.api_key !== undefined) values.api_key = dto.api_key.trim();
    if (dto.descripcion !== undefined) {
      values.descripcion = dto.descripcion?.trim() || null;
    }
    if (dto.item !== undefined) values.item = dto.item?.trim() || null;
    if (dto.provincia !== undefined) {
      values.provincia = dto.provincia?.trim() || null;
    }
    if (dto.departamento !== undefined) {
      values.departamento = dto.departamento?.trim() || null;
    }
    if (dto.kms !== undefined) values.kms = dto.kms;
    if (dto.activo !== undefined) values.activo = dto.activo;

    return values;
  }
}
