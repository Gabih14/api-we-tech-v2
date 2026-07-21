import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VtaCliente } from './entities/vta_cliente.entity';
import { CreateVtaClienteDto } from './dto/create-vta_cliente.dto';
import { UpdateVtaClienteDto } from './dto/update-vta_cliente.dto';
import type { DireccionSeparada } from '../maps/maps.service';

@Injectable()
export class VtaClienteService {
  private readonly logger = new Logger(VtaClienteService.name);

  constructor(
    @InjectRepository(VtaCliente)
    private readonly repo: Repository<VtaCliente>,
  ) {}

  /**
   * Busca un cliente por CUIT (id). Si no existe, lo crea.
   * Si existe y cambió algún dato, lo actualiza.
   */
  /* findOrCreateOrUpdate */
  async findOrCreateOrUpdate(dto: CreateVtaClienteDto): Promise<VtaCliente> {
    const clienteDto = this.normalizarClienteDto(dto);

    if (!clienteDto.id) {
      throw new Error('El cliente debe tener un CUIT válido como ID.');
    }

    const existing = await this.repo.findOne({ where: { id: clienteDto.id } });

    if (existing) {
      const updateDto = this.omitirValoresVacios(clienteDto);

      // Chequea si hay diferencias
      const hasChanges = Object.entries(updateDto).some(
        ([key, value]) => value !== (existing as any)[key],
      );

      if (hasChanges) {
        await this.repo.update(clienteDto.id, updateDto);
      }

      // ✅ Asegurar que retornamos el cliente actualizado
      const updated = await this.repo.findOne({ where: { id: clienteDto.id } });
      if (!updated) {
        throw new Error('Error al recuperar el cliente actualizado');
      }
      return updated;
    }

    const nuevoCliente = this.repo.create({
      ...clienteDto,
      id: clienteDto.id,
      razonSocial: clienteDto.razonSocial || 'Cliente sin nombre', // ✅ Quitar dto.name
      nombreComercial: clienteDto.nombreComercial || null,          // ✅ Quitar dto.name
      tipoDocumento: clienteDto.tipoDocumento || 'CUIL',
      numeroDocumento: clienteDto.numeroDocumento || clienteDto.id,
      email: clienteDto.email || null,
      telefono: clienteDto.telefono || null,
      condicionIva: clienteDto.condicionIva || 'CF',
      visible: clienteDto.visible ?? true,
      contacto: clienteDto.contacto || null,
    });

    return this.repo.save(nuevoCliente);
  }

  async create(dto: CreateVtaClienteDto) {
    const cliente = this.repo.create(this.normalizarClienteDto(dto));
    return this.repo.save(cliente);
  }

  private omitirValoresVacios<T extends Record<string, any>>(dto: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(dto).filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        return true;
      }),
    ) as Partial<T>;
  }

  /**
   * 🚩 Detecta direcciones que entraron sin parsear (formatted_address crudo de
   * Google, o con el CP pegado en el medio del string). No bloquea el guardado
   * para no cortar un pedido en curso: deja el caso logueado para revisión.
   */
  private direccionSospechosa(direccion?: string): boolean {
    if (!direccion) return false;
    // Termina en ", Argentina" -> es un formatted_address crudo
    if (/,\s*Argentina\s*$/i.test(direccion)) return true;
    // Tiene un código postal pegado en el medio del string
    if (/,\s*[A-Z]?\d{4}[A-Z]{0,3}\s+\S/.test(direccion)) return true;
    return false;
  }

  private normalizarClienteDto(
    dto: Partial<CreateVtaClienteDto>,
  ): Partial<CreateVtaClienteDto> {
    const telefono = this.formatearTelefono(dto.telefono);

    if (this.direccionSospechosa(dto.direccion)) {
      this.logger.warn(
        `Cliente ${dto.id ?? 's/id'}: dirección sin parsear, revisar a mano -> "${dto.direccion}"`,
      );
    }

    return {
      ...dto,
      razonSocial: this.capitalizarPalabras(dto.razonSocial),
      numeroDocumento: this.formatearNumeroDocumento(
        dto.numeroDocumento || dto.id,
      ),
      telefono,
      contacto: telefono,
      cpa: this.normalizarCpa(dto.cpa),
      condicionIva: dto.condicionIva || 'CF',
    };
  }

  /**
   * 📮 El ERP guarda el CP corto de 4 dígitos (2.645 de 2.653 registros), no el
   * CPA extendido de Google. De "M5502HAN" o "M5539 Las Heras" saca "5502"/"5539".
   */
  private normalizarCpa(value?: string): string | undefined {
    if (!value) return undefined;

    const corto = value.match(/\d{4}/);
    return corto ? corto[0] : value;
  }

  private capitalizarPalabras(value?: string): string | undefined {
    if (!value) return undefined;

    return value
      .trim()
      .split(/(\s+)/)
      .map((parte) => {
        if (parte.trim() === '') return parte;
        return (
          parte.charAt(0).toLocaleUpperCase('es-AR') +
          parte.slice(1).toLocaleLowerCase('es-AR')
        );
      })
      .join('');
  }

  private formatearNumeroDocumento(value?: string): string | undefined {
    if (!value) return undefined;

    const digitos = value.replace(/\D/g, '');
    if (digitos.length !== 11) {
      return value;
    }

    return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
  }

  private formatearTelefono(value?: string): string | undefined {
    if (!value) return undefined;

    const digitos = value.replace(/\D/g, '');
    if (!digitos) {
      return value;
    }

    // 📞 Se guarda siempre como "549" + número nacional, sin el "+".
    // El código de país puede venir repetido ("54954...", "5454...") cuando el
    // cliente lo tipea a mano en un campo que ya tiene el +54 9 fijo al lado:
    // se saca tantas veces como aparezca.
    let nacional = digitos;
    while (/^54/.test(nacional)) {
      const resto = nacional.replace(/^549?/, '');
      if (!resto) break;
      nacional = resto;
    }

    // Saca el 0 de larga distancia (0261... -> 261...)
    nacional = nacional.replace(/^0+/, '');

    // Saca el 15 de los celulares viejos (0261 15 2533669): con el 549 adelante
    // el 15 no va. Solo si al sacarlo quedan los 10 dígitos de un número real.
    if (nacional.length === 12) {
      const sinQuince = nacional.replace(/^(\d{2,4})15(?=\d)/, '$1');
      if (sinQuince.length === 10) {
        nacional = sinQuince;
      }
    }

    // Si quedó algo que no puede ser un número argentino, se deja el valor
    // original para que alguien lo revise en vez de guardar un dato inventado.
    if (nacional.length < 8) {
      return value;
    }

    return `549${nacional}`;
  }

  async findAll() {
    const clientes = await this.repo.find();
    return clientes.map(cliente => ({
      ...cliente,
      id: cliente.id.replace(/-/g, '')
    }));
  }

  async findOne(id: string) {
    const cliente = await this.repo.findOne({ where: { id } });
    if (!cliente) return null;

    return {
      ...cliente,
      id: cliente.id.replace(/-/g, ''),
      // 🏠 Misma forma que devuelve /maps/distance, para que el checkout use un
      // solo mapeo al autocompletar (cliente que vuelve vs. dirección nueva).
      direccionSeparada: this.separarDireccionCliente(cliente),
    };
  }

  /**
   * 🏠 Arma el objeto direccionSeparada desde las columnas del ERP. El ERP guarda
   * calle+número juntos en `direccion` (varchar único, esquema compartido con
   * Nacional Gestión), así que `numero` va vacío y todo queda en `calle`: al
   * enviar el pedido el front recombina en `calle` igual, sin perder nada.
   */
  private separarDireccionCliente(cliente: VtaCliente): DireccionSeparada {
    const { calle, numero } = this.separarCalleNumero(cliente.direccion ?? '');
    return {
      calle,
      numero,
      ciudad: cliente.localidad ?? '',
      provincia: cliente.provincia ?? '',
      codigoPostal: this.normalizarCpa(cliente.cpa ?? undefined) ?? '',
      pais: cliente.pais ?? 'Argentina',
    };
  }

  /**
   * 🔢 Separa "calle número" (como lo guarda el ERP en una sola columna) en dos
   * campos para prellenar el checkout. Corta en el primer número que aparece
   * DESPUÉS de una letra, así "9 de Julio 1779" no confunde el 9 del nombre con
   * la altura. Es una división best-effort solo para prellenar: es lossless
   * porque el front vuelve a concatenar calle+número al enviar el pedido, así
   * que un corte imperfecto ("984 4") no corrompe el dato guardado.
   */
  private separarCalleNumero(direccion: string): {
    calle: string;
    numero: string;
  } {
    const match = direccion.match(/^(.*?\p{L}.*?)\s+(\d.*)$/u);
    if (!match) return { calle: direccion.trim(), numero: '' };
    return { calle: match[1].trim(), numero: match[2].trim() };
  }

  async update(id: string, dto: UpdateVtaClienteDto) {
    const updateDto = this.omitirValoresVacios(dto);
    if (Object.keys(updateDto).length > 0) {
      await this.repo.update(id, updateDto);
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.repo.delete(id);
    return typeof result.affected === 'number' && result.affected > 0
      ? { message: `Cliente ${id} eliminado.` }
      : { message: `Cliente ${id} no encontrado.` };
  }
}
