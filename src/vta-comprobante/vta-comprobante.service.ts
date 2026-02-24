// src/vta-comprobante/vta-comprobante.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { VtaComprobanteItemService } from 'src/vta-comprobante-item/vta-comprobante-item.service';
import { VtaClienteService } from 'src/vta_cliente/vta_cliente.service';
import { CreateVtaClienteDto } from 'src/vta_cliente/dto/create-vta_cliente.dto';
import { VtaComprobanteAsientoService } from 'src/vta_comprobante_asiento/vta_comprobante_asiento.service';

@Injectable()
export class VtaComprobanteService {
  constructor(
    @InjectRepository(VtaComprobante)
    private readonly comprobanteRepository: Repository<VtaComprobante>,

    private readonly comprobanteItemService: VtaComprobanteItemService,
    private readonly clienteService: VtaClienteService,
    private readonly vtaComprobanteAsientoService: VtaComprobanteAsientoService,
  ) {}

  // 🧾 Crear comprobante a partir de un pedido aprobado
  async crearDesdePedido(pedido: Pedido): Promise<VtaComprobante> {
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    // 👤 Asegurar que el cliente exista (crear/actualizar según corresponda)
    const ubicacionParsed = this.parseUbicacion(pedido.cliente_ubicacion);

    const clientePayload: CreateVtaClienteDto = {
      id: pedido.cliente_cuit,
      razonSocial: pedido.cliente_nombre,
      tipoDocumento: 'CUIT',
      numeroDocumento: pedido.cliente_cuit,
      email: pedido.cliente_mail,
      telefono: pedido.telefono,
      direccion: ubicacionParsed.direccion,
      localidad: ubicacionParsed.localidad,
      provincia: ubicacionParsed.provincia,
      condicionIva: 'CF',
      visible: true,
    };
    await this.clienteService.findOrCreateOrUpdate(clientePayload);

    const numero = await this.generarNumeroComprobante();

    const cantidadTotal = pedido.productos?.reduce(
      (acc, p) => acc + (p.cantidad ?? 0),
      0,
    );

    const itemsCalculo = (pedido.productos ?? []).map((producto) => {
      const cantidad = Number(producto.cantidad ?? 0);
      const precioFinalUnitario = Number(producto.precio_unitario ?? 0);
      const importeFinal = this.redondear2(cantidad * precioFinalUnitario);
      const ajustePctRaw = producto.ajuste_porcentaje;

      if (
        ajustePctRaw === null ||
        ajustePctRaw === undefined ||
        Number(ajustePctRaw) === 0
      ) {
        return {
          producto,
          base: importeFinal,
          importe: importeFinal,
          ajuste: null,
          ajusteNeto: null,
          precioBaseUnitario: this.redondear2(precioFinalUnitario),
        };
      }

      const descuentoPct = Math.abs(Number(ajustePctRaw));
      const factor = 1 - descuentoPct / 100;
      const base =
        factor > 0 ? this.redondear2(importeFinal / factor) : importeFinal;
      const ajusteNeto = this.redondear2(importeFinal - base);
      const precioBaseUnitario =
        cantidad > 0
          ? this.redondear2(base / cantidad)
          : this.redondear2(precioFinalUnitario);

      return {
        producto,
        base,
        importe: importeFinal,
        ajuste: this.redondear2(-descuentoPct),
        ajusteNeto,
        precioBaseUnitario,
      };
    });

    const baseTotal = this.redondear2(
      itemsCalculo.reduce((acc, item) => acc + item.base, 0),
    );
    const totalImporte = this.redondear2(
      itemsCalculo.reduce((acc, item) => acc + item.importe, 0),
    );
    const totalAjusteNeto = this.redondear2(
      itemsCalculo.reduce((acc, item) => acc + (item.ajusteNeto ?? 0), 0),
    );
    const ajusteCabecera =
      baseTotal !== 0 && totalAjusteNeto !== 0
        ? this.redondear2((totalAjusteNeto / baseTotal) * 100)
        : null;

    const cobroFields: Partial<VtaComprobante> =
      (pedido.metodo_pago ?? 'online') === 'transfer'
        ? { cobrado: 0, fecha_cobro: undefined }
        : { cobrado: totalImporte };

    const nuevoComprobanteData: DeepPartial<VtaComprobante> = {
      tipo: 'FX',
      comprobante: numero,
      cliente: pedido.cliente_cuit,
      razon_social: pedido.cliente_nombre,
      fecha: new Date(),
      periodo: this.obtenerPeriodoActual(),
      tipo_documento: 'CUIT',
      numero_documento: pedido.cliente_cuit,
      moneda: 'PES',
      cotizacion: 1,
      lista: 'MINORISTA', // Hacerlo variable cuando se implemente esa funcionalidad de mayorista/minorista
      ivainc: true,
      anclar_precio: true,
      anulado: false,
      comisionliq: false,
      subtotal: totalImporte,
      neto: 0,
      exento: 0,
      nogravado: totalImporte,
      iva: 0,
      impuesto_1: 0,
      impuesto_2: 0,
      impuesto_3: 0,
      impuesto_4: 0,
      impuesto_5: 0,
      impuesto_6: 0,
      impuesto_7: 0,
      impuesto_8: 0,
      impuesto_9: 0,
      total: totalImporte,
      ajuste: ajusteCabecera ?? undefined,
      ajuste_neto: totalAjusteNeto === 0 ? undefined : totalAjusteNeto,
      ajuste_iva: undefined,
      cantidad: cantidadTotal ?? 0,
      entregado: 0,
      entregado$: 0,
      trabajador: 'WEB',
      ...cobroFields,
      adjuntos: false,
      adjuntado: false,
      mail: false,
      visible: true,
    };

    const nuevoComprobante = this.comprobanteRepository.create(
      nuevoComprobanteData,
    );

    const comprobanteGuardado =
      await this.comprobanteRepository.save(nuevoComprobante);

    // 🧮 Crear ítems asociados
    let linea = 1;
    for (const item of itemsCalculo) {
      const producto = item.producto;
      await this.comprobanteItemService.create({
        tipo: comprobanteGuardado.tipo,
        comprobante: comprobanteGuardado.comprobante,
        linea,
        cantidad: producto.cantidad,
        precio: item.precioBaseUnitario,
        importe: item.importe,
        ajuste: item.ajuste ?? undefined,
        ajuste_neto: item.ajusteNeto ?? undefined,
        ajuste_iva: undefined,
        itemId: producto.nombre, // el ID del producto
      } as any);
      linea++;
    }

    // 📝 Generar asiento contable y vínculo
    await this.vtaComprobanteAsientoService.createAsientoForComprobante(
      comprobanteGuardado.tipo,
      comprobanteGuardado.comprobante,
      pedido.metodo_pago ?? 'online', // Pasar método de pago para seleccionar cuenta correcta
    );

    return comprobanteGuardado;
  }

  // 🔢 Genera el número en formato "X 00001 00000227"
  private async generarNumeroComprobante(): Promise<string> {
    const letra = 'X';
    const puntoDeVenta = '00001';

    const ultimo = await this.comprobanteRepository
      .createQueryBuilder('c')
      .where('c.tipo = :tipo', { tipo: 'FX' })
      .andWhere('c.comprobante LIKE :prefix', {
        prefix: `${letra} ${puntoDeVenta} %`,
      })
      .orderBy('c.comprobante', 'DESC')
      .getOne();

    let nuevoNumero = 1;

    if (ultimo) {
      const partes = ultimo.comprobante.trim().split(' ');
      const numeroActual = parseInt(partes[2], 10);
      if (!isNaN(numeroActual)) nuevoNumero = numeroActual + 1;
    }

    const numeroFormateado = nuevoNumero.toString().padStart(8, '0');
    return `${letra} ${puntoDeVenta} ${numeroFormateado}`;
  }

  // 📅 Devuelve el período en formato "MM/YYYY"
  private obtenerPeriodoActual(): string {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }

  // 🏠 Parsea string de ubicación y extrae dirección, localidad, provincia
  private parseUbicacion(ubicacionString: string): {
    direccion?: string;
    localidad?: string;
    provincia?: string;
  } {
    if (!ubicacionString) return {};

    // Formato esperado: "calle numero, ciudad, region, pais, postal_code"
    const partes = ubicacionString.split(',').map((p) => p.trim());

    return {
      direccion: partes[0] || undefined, // Calle y número
      localidad: partes[1] || undefined, // Ciudad
      provincia: partes[2] || undefined, // Región/Provincia
    };
  }

  private redondear2(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  // 🔍 Métodos básicos opcionales
  async findAll(): Promise<VtaComprobante[]> {
    return this.comprobanteRepository.find({ relations: ['items'] });
  }

  async findOne(tipo: string, comprobante: string): Promise<VtaComprobante> {
    const entity = await this.comprobanteRepository.findOne({
      where: { tipo, comprobante },
      relations: ['items'],
    });
    if (!entity) throw new NotFoundException('Comprobante no encontrado');
    return entity;
  }
}
