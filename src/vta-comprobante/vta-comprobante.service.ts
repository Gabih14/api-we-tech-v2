// src/vta-comprobante/vta-comprobante.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { VtaComprobante } from './entities/vta-comprobante.entity';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { VtaComprobanteItemService } from 'src/vta-comprobante-item/vta-comprobante-item.service';
import { VtaClienteService } from 'src/vta_cliente/vta_cliente.service';
import { CreateVtaClienteDto } from 'src/vta_cliente/dto/create-vta_cliente.dto';
import { VtaComprobanteAsientoService } from 'src/vta_comprobante_asiento/vta_comprobante_asiento.service';
import { VtaCobro } from 'src/vta-cobro/entities/vta-cobro.entity';
import { VtaCobroMedio } from 'src/vta-cobro-medio/entities/vta-cobro-medio.entity';
import { VtaCobroFactura } from 'src/vta-cobro-factura/entities/vta-cobro-factura.entity';
import { VtaComprobanteAsiento } from 'src/vta_comprobante_asiento/entities/vta_comprobante_asiento.entity';
import { VtaComprobanteItem } from 'src/vta-comprobante-item/entities/vta-comprobante-item.entity';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';

type RawResumenMetricas = {
  totalVentas: string | null;
  cantidadComprobantes: string | null;
  ticketPromedio: string | null;
};

type RawVentasMensuales = {
  mes: string;
  totalVentas: string | null;
  cantidadComprobantes: string | null;
};

type RawVentasPorVendedor = {
  vendedor: string;
  totalVentas: string | null;
  cantidadComprobantes: string | null;
};

@Injectable()
export class VtaComprobanteService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(VtaComprobante)
    private readonly comprobanteRepository: Repository<VtaComprobante>,

    private readonly comprobanteItemService: VtaComprobanteItemService,
    private readonly clienteService: VtaClienteService,
    private readonly vtaComprobanteAsientoService: VtaComprobanteAsientoService,
  ) {}

  async eliminarComprobantePorPedido(
    tipo: string,
    comprobante: string,
  ): Promise<{ eliminado: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const comprobanteRepo = manager.getRepository(VtaComprobante);
      const comprobanteEntity = await comprobanteRepo.findOne({
        where: { tipo, comprobante },
      });

      if (!comprobanteEntity) {
        return { eliminado: false };
      }

      const cobroFacturaRepo = manager.getRepository(VtaCobroFactura);
      const cobroMedioRepo = manager.getRepository(VtaCobroMedio);
      const cobroRepo = manager.getRepository(VtaCobro);
      const asientoLinkRepo = manager.getRepository(VtaComprobanteAsiento);
      const asientoRepo = manager.getRepository(CntAsiento);
      const comprobanteItemRepo = manager.getRepository(VtaComprobanteItem);

      const asientosLink = await asientoLinkRepo.find({
        where: { tipo, comprobante },
      });

      const cobrosVinculados = await cobroFacturaRepo.find({
        where: { tipo, factura: comprobante },
      });
      const cobroIds = Array.from(
        new Set(cobrosVinculados.map((row) => row.cobro).filter(Boolean)),
      );

      if (cobroIds.length > 0) {
        await cobroMedioRepo
          .createQueryBuilder()
          .delete()
          .where('cobro IN (:...cobroIds)', { cobroIds })
          .execute();

        await cobroFacturaRepo
          .createQueryBuilder()
          .delete()
          .where('cobro IN (:...cobroIds)', { cobroIds })
          .execute();

        await cobroRepo
          .createQueryBuilder()
          .delete()
          .where('numero IN (:...cobroIds)', { cobroIds })
          .execute();
      } else {
        await cobroFacturaRepo.delete({ tipo, factura: comprobante });
      }

      let asientosEliminados = 0;
      let asientosPreservados = 0;

      for (const link of asientosLink) {
        const usoExterno = await manager.query(
          `
          SELECT
            EXISTS(SELECT 1 FROM cmp_comprobante_asiento WHERE ejercicio = ? AND asiento = ?) AS in_cmp_comp,
            EXISTS(SELECT 1 FROM cmp_pago_asiento WHERE ejercicio = ? AND asiento = ?) AS in_cmp_pago,
            EXISTS(SELECT 1 FROM fnd_movimiento_asiento WHERE ejercicio = ? AND asiento = ?) AS in_fnd,
            EXISTS(SELECT 1 FROM vta_cobro_asiento WHERE ejercicio = ? AND asiento = ?) AS in_vta_cobro
          `,
          [
            link.ejercicio,
            link.asiento,
            link.ejercicio,
            link.asiento,
            link.ejercicio,
            link.asiento,
            link.ejercicio,
            link.asiento,
          ],
        );

        const row = usoExterno?.[0] ?? {};
        const usadoEnOtrosModulos =
          Number(row.in_cmp_comp) > 0 ||
          Number(row.in_cmp_pago) > 0 ||
          Number(row.in_fnd) > 0 ||
          Number(row.in_vta_cobro) > 0;

        if (!usadoEnOtrosModulos) {
          await asientoRepo.delete({
            ejercicio: link.ejercicio,
            id: link.asiento,
          });
          asientosEliminados += 1;
        } else {
          asientosPreservados += 1;
        }

        await asientoLinkRepo.delete({
          tipo: link.tipo,
          comprobante: link.comprobante,
          ejercicio: link.ejercicio,
          asiento: link.asiento,
        });
      }

      if (asientosPreservados > 0) {
        console.warn(
          `Comprobante ${tipo} ${comprobante}: ${asientosPreservados} asiento(s) preservado(s) por uso externo y ${asientosEliminados} eliminado(s).`,
        );
      }

      await comprobanteItemRepo.delete({ tipo, comprobante });
      await comprobanteRepo.delete({ tipo, comprobante });

      return { eliminado: true };
    });
  }

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
      cpa: ubicacionParsed.cpa,
      observaciones: pedido.observaciones_direccion ?? undefined,
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
      const base = this.redondear2(Number(producto.subtotal ?? importeFinal));
      const ajusteNeto = this.redondear2(importeFinal - base);
      const precioBaseUnitario =
        cantidad > 0
          ? this.redondear2(base / cantidad)
          : this.redondear2(precioFinalUnitario);
      const ajuste =
        base !== 0 && ajusteNeto !== 0
          ? this.redondear2((ajusteNeto / base) * 100)
          : null;

      return {
        producto,
        base,
        importe: importeFinal,
        ajuste,
        ajusteNeto,
        precioBaseUnitario,
      };
    });

    const baseTotal = this.redondear2(
      itemsCalculo.reduce((acc, item) => acc + item.base, 0),
    );
    // ✅ Usar el total del pedido para evitar discrepancias por redondeo
    const totalImporte = this.redondear2(pedido.total);
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

  // 🏠 Parsea string de ubicación y extrae dirección, localidad, provincia y CPA
  private parseUbicacion(ubicacionString: string): {
    direccion?: string;
    localidad?: string;
    provincia?: string;
    cpa?: string;
  } {
    if (!ubicacionString) return {};

    // Formato esperado: "calle numero, ciudad, region, pais, postal_code"
    const partes = ubicacionString.split(',').map((p) => p.trim());

    return {
      direccion: partes[0] || undefined, // Calle y número
      localidad: partes[1] || undefined, // Ciudad
      provincia: partes[2] || undefined, // Región/Provincia
      cpa: partes[4] || undefined, // Código postal
    };
  }

  private redondear2(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private parseDateRange(from?: string, to?: string): {
    fromDate?: Date;
    toDate?: Date;
  } {
    const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;

    return {
      fromDate:
        fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
      toDate: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
    };
  }

  async getResumenMetricas(from?: string, to?: string): Promise<{
    totalVentas: number;
    cantidadComprobantes: number;
    ticketPromedio: number;
  }> {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    const qb = this.comprobanteRepository.createQueryBuilder('c');

    qb.select('COALESCE(SUM(c.total), 0)', 'totalVentas')
      .addSelect('COUNT(*)', 'cantidadComprobantes')
      .addSelect('COALESCE(AVG(c.total), 0)', 'ticketPromedio')
      .where('(c.anulado IS NULL OR c.anulado = :anulado)', { anulado: false })
      .andWhere('c.fecha IS NOT NULL');

    if (fromDate) {
      qb.andWhere('c.fecha >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('c.fecha <= :toDate', { toDate });
    }

    const raw = await qb.getRawOne<RawResumenMetricas>();

    return {
      totalVentas: Number(raw?.totalVentas ?? 0),
      cantidadComprobantes: Number(raw?.cantidadComprobantes ?? 0),
      ticketPromedio: Number(raw?.ticketPromedio ?? 0),
    };
  }

  async getVentasMensuales(
    from?: string,
    to?: string,
  ): Promise<
    Array<{ mes: string; totalVentas: number; cantidadComprobantes: number }>
  > {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    const qb = this.comprobanteRepository.createQueryBuilder('c');

    qb.select("DATE_FORMAT(c.fecha, '%Y-%m')", 'mes')
      .addSelect('COALESCE(SUM(c.total), 0)', 'totalVentas')
      .addSelect('COUNT(*)', 'cantidadComprobantes')
      .where('(c.anulado IS NULL OR c.anulado = :anulado)', { anulado: false })
      .andWhere('c.fecha IS NOT NULL');

    if (fromDate) {
      qb.andWhere('c.fecha >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('c.fecha <= :toDate', { toDate });
    }

    const rows = await qb
      .groupBy("DATE_FORMAT(c.fecha, '%Y-%m')")
      .orderBy('mes', 'ASC')
      .getRawMany<RawVentasMensuales>();

    return rows.map((row) => ({
      mes: row.mes,
      totalVentas: Number(row.totalVentas ?? 0),
      cantidadComprobantes: Number(row.cantidadComprobantes ?? 0),
    }));
  }

  async getVentasPorVendedor(
    from?: string,
    to?: string,
  ): Promise<
    Array<{
      vendedor: string;
      totalVentas: number;
      cantidadComprobantes: number;
    }>
  > {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    const qb = this.comprobanteRepository.createQueryBuilder('c');

    qb.select("COALESCE(NULLIF(TRIM(c.trabajador), ''), 'SIN_VENDEDOR')", 'vendedor')
      .addSelect('COALESCE(SUM(c.total), 0)', 'totalVentas')
      .addSelect('COUNT(*)', 'cantidadComprobantes')
      .where('(c.anulado IS NULL OR c.anulado = :anulado)', { anulado: false })
      .andWhere('c.fecha IS NOT NULL');

    if (fromDate) {
      qb.andWhere('c.fecha >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('c.fecha <= :toDate', { toDate });
    }

    const rows = await qb
      .groupBy("COALESCE(NULLIF(TRIM(c.trabajador), ''), 'SIN_VENDEDOR')")
      .orderBy('totalVentas', 'DESC')
      .getRawMany<RawVentasPorVendedor>();

    return rows.map((row) => ({
      vendedor: row.vendedor,
      totalVentas: Number(row.totalVentas ?? 0),
      cantidadComprobantes: Number(row.cantidadComprobantes ?? 0),
    }));
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
