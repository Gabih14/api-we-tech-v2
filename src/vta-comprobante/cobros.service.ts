import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { VtaComprobante } from "./entities/vta-comprobante.entity";
import { VtaCobro } from "../vta-cobro/entities/vta-cobro.entity";
import { VtaCobroMedio } from "../vta-cobro-medio/entities/vta-cobro-medio.entity";
import { VtaCobroFactura } from "../vta-cobro-factura/entities/vta-cobro-factura.entity";
import { CobrarFacturaDto } from "./dto/cobrar-factura.dto";
import { Pedido } from "../pedido/entities/pedido.entity";
import {
  buildPedidoComprobanteReference,
  PEDIDO_COMPROBANTE_REFERENCE_PREFIX,
} from "../pedido/pedido-comprobante-reference";

type Modalidad = CobrarFacturaDto["modalidad"];

@Injectable()
export class CobrosService {
  private readonly logger = new Logger(CobrosService.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(VtaComprobante)
    private readonly comprobanteRepo: Repository<VtaComprobante>,

    @InjectRepository(VtaCobro)
    private readonly cobroRepo: Repository<VtaCobro>,

    @InjectRepository(VtaCobroMedio)
    private readonly cobroMedioRepo: Repository<VtaCobroMedio>,

    @InjectRepository(VtaCobroFactura)
    private readonly cobroFacturaRepo: Repository<VtaCobroFactura>,
  ) {}

  async cobrarFactura(tipo: string, comprobante: string, dto: CobrarFacturaDto) {
    const modalidad: Modalidad = dto.modalidad;
    const medioId = dto.medioId;
    const trabajador = dto.trabajador ?? "MARTINA";
    const user = dto.user ?? "martina";
    const puntoVenta = dto.puntoVenta ?? "00001";

    return this.dataSource.transaction(async (manager) => {
      if (modalidad === "CUENTA") {
        const cuentaExiste = await manager.query(
          "SELECT 1 FROM fnd_cuenta WHERE id = ? LIMIT 1",
          [medioId],
        );

        if (!Array.isArray(cuentaExiste) || cuentaExiste.length === 0) {
          throw new NotFoundException(
            `CUENTA '${medioId}' no existe en fnd_cuenta. Revisa NAVE_CUENTA_ID.`,
          );
        }
      }

      // 1) Traer comprobante
      const factura = await manager.getRepository(VtaComprobante).findOne({
        where: { tipo, comprobante },
      });

      if (!factura) throw new NotFoundException("Comprobante no encontrado");

      const total = Number(factura.total ?? 0);
      if (!Number.isFinite(total) || total <= 0) {
        throw new BadRequestException(`Total inválido: ${factura.total}`);
      }

      // 2) Evitar doble cobro (si ya existe un vínculo)
      const yaImputada = await manager.getRepository(VtaCobroFactura).findOne({
        where: { tipo, factura: comprobante },
      });
      if (yaImputada) {
        throw new BadRequestException(`Ya existe cobro imputado: ${yaImputada.cobro}`);
      }

      // 3) Generar número de cobro: "F 00001 00017010"
      //    Usamos MAX(numero) por prefijo (funciona por padding de 8 dígitos)
      const prefix = `F ${puntoVenta} `;

      const raw = await manager.query(
        `
        SELECT MAX(numero) AS maxNumero
        FROM vta_cobro
        WHERE numero LIKE CONCAT(?, '%')
        FOR UPDATE
        `,
        [prefix],
      );

      const maxNumero: string | null = raw?.[0]?.maxNumero ?? null;

      let nextSeq = "00000001";
      if (maxNumero) {
        const seq = maxNumero.slice(prefix.length); // "00017010"
        const n = parseInt(seq, 10);
        if (!isNaN(n)) nextSeq = String(n + 1).padStart(8, "0");
      }

      const cobroNumero = `${prefix}${nextSeq}`;

      // helper para setear buckets como hace el sistema
      const buckets = this.buildBuckets(modalidad, total);

      // 4) Insert vta_cobro (imitando el registro real que viste)
      const cobro = manager.getRepository(VtaCobro).create({
        numero: cobroNumero,
        cliente: factura.cliente,
        fecha: new Date(),
        moneda: "PES",
        cotizacion: "1.0000",
        trabajador,
        ...buckets,
        total: total.toFixed(2),
        subtotalFactura: total.toFixed(2),
        totalFactura: total.toFixed(2),
        user,
        visible: true,
        adjuntos: false,
        adjuntado: false,
        mail: false,
        anulado: false,
        comisionliq: false,
      });

      await manager.getRepository(VtaCobro).save(cobro);

      // 5) Insert vta_cobro_medio (la línea visible en la pestaña Cobro)
      const medio = manager.getRepository(VtaCobroMedio).create({
        cobro: cobroNumero,
        linea: 1,
        importe: total.toFixed(2),
        modalidad,
        conciliado: false,
        imputacion: new Date().toISOString().slice(0, 10), // YYYY-MM-DD

        caja: modalidad === "CAJA" ? medioId : null,
        cuenta: modalidad === "CUENTA" ? medioId : null,
        tarjeta: modalidad === "TARJETA" ? medioId : null,
        cheque: modalidad === "CHEQUE" ? medioId : null,
        cheque_3ro: modalidad === "CHEQUE_3RO" ? medioId : null,
        certificado: modalidad === "CERTIFICADO" ? medioId : null,
        // CTACTE: a veces se maneja con cliente/detalle. Lo dejamos simple.
      });

      await manager.getRepository(VtaCobroMedio).save(medio);

      // 6) Insert vta_cobro_factura (vínculo imprescindible)
      const link = manager.getRepository(VtaCobroFactura).create({
        cobro: cobroNumero,
        tipo,
        factura: comprobante,
        linea: 1,
        importe: total.toFixed(2),
        cotizacion: "1.0000",
        ajusteximp: false,
        ajuste: "0.00",
        ajusteImporte: "0.00",
      });

      await manager.getRepository(VtaCobroFactura).save(link);

      // 7) Mantener coherente la factura
      factura.cobrado = total;
      factura.fecha_cobro = new Date();
      await manager.getRepository(VtaComprobante).save(factura);

      return { cobroNumero, tipo, comprobante, total };
    });
  }

  async tieneCobroFactura(tipo: string, comprobante: string): Promise<boolean> {
    const cobro = await this.cobroFacturaRepo.findOne({
      where: { tipo, factura: comprobante },
    });
    return !!cobro;
  }

  async tieneCobroFacturaDelPedido(
    tipo: string,
    comprobante: string,
    pedido: Pick<
      Pedido,
      "external_id" | "cliente_cuit" | "cliente_mail" | "total" | "creado"
    >,
  ): Promise<boolean> {
    const factura = await this.comprobanteRepo.findOne({
      where: { tipo, comprobante },
    });

    if (!factura || factura.anulado) {
      return false;
    }

    if (!this.comprobantePerteneceAlPedido(factura, pedido)) {
      this.logger.warn(
        `[${pedido.external_id}] Se ignora cobro de ${tipo} ${comprobante}: el comprobante no corresponde al pedido`,
      );
      return false;
    }

    return this.tieneCobroFactura(tipo, comprobante);
  }

  private comprobantePerteneceAlPedido(
    factura: VtaComprobante,
    pedido: Pick<
      Pedido,
      "external_id" | "cliente_cuit" | "cliente_mail" | "total" | "creado"
    >,
  ): boolean {
    const referencia = factura.observaciones_int?.trim();
    const referenciaEsperada = buildPedidoComprobanteReference(
      pedido.external_id,
    );
    const clienteFactura = (factura.cliente || factura.numero_documento || "")
      .trim()
      .toLowerCase();
    const clientePedido = pedido.cliente_cuit.trim().toLowerCase();
    const totalFactura = Number(factura.total);
    const totalPedido = Number(pedido.total);
    const datosPrincipalesCoinciden =
      clienteFactura === clientePedido &&
      Number.isFinite(totalFactura) &&
      Number.isFinite(totalPedido) &&
      Math.abs(totalFactura - totalPedido) < 0.01;

    if (referencia?.startsWith(PEDIDO_COMPROBANTE_REFERENCE_PREFIX)) {
      return referencia === referenciaEsperada && datosPrincipalesCoinciden;
    }

    // Compatibilidad para comprobantes creados antes de incorporar la referencia.
    // Además de cliente y total, deben haberse creado cerca del pedido original;
    // así un número eliminado y reutilizado no puede aprobar un pedido antiguo.
    const fechaFactura = factura.fecha?.getTime();
    const fechaPedido = pedido.creado?.getTime();
    const fechasCoinciden =
      Number.isFinite(fechaFactura) &&
      Number.isFinite(fechaPedido) &&
      Math.abs((fechaFactura as number) - (fechaPedido as number)) <=
        60 * 60_000;
    const emailFactura = factura.email?.trim().toLowerCase();
    const emailPedido = pedido.cliente_mail?.trim().toLowerCase();
    const emailsCoinciden =
      !emailFactura || !emailPedido || emailFactura === emailPedido;

    return datosPrincipalesCoinciden && fechasCoinciden && emailsCoinciden;
  }

  private buildBuckets(modalidad: Modalidad, total: number) {
    const v = total.toFixed(2);

    return {
      caja: modalidad === "CAJA" ? v : "0.00",
      cuenta: modalidad === "CUENTA" ? v : "0.00",
      tarjeta: modalidad === "TARJETA" ? v : "0.00",
      cheque: modalidad === "CHEQUE" ? v : "0.00",
      cheque_3ro: modalidad === "CHEQUE_3RO" ? v : "0.00",
      certificado: modalidad === "CERTIFICADO" ? v : "0.00",
      ctacte: modalidad === "CTACTE" ? v : "0.00",
    } satisfies Partial<VtaCobro>;
  }
}
