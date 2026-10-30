import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateVtaComprobanteAsientoDto } from './dto/create-vta_comprobante_asiento.dto';
import { UpdateVtaComprobanteAsientoDto } from './dto/update-vta_comprobante_asiento.dto';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobante } from 'src/vta-comprobante/entities/vta-comprobante.entity';
import { VtaComprobanteAsiento } from './entities/vta_comprobante_asiento.entity';

const CUENTAS_VENTA: Record<string, string> = {
  'MERCADERIA FILAMENTO': '4.1.01.001.0000',
  'VENTA DE FILAMENTO': '4.1.01.001.0000',
  'MERCADERIA IMPRESORA': '4.1.01.002.0000',
  'MERCADERIA REPUESTOS': '4.1.01.003.0000',
  'VENTA SERV TECNICO': '4.1.01.005.0000',
  'VENTA CURSOS': '4.1.01.006.0000',
  'VENTA ENVIO CLIENTE': '4.1.01.007.0000',
  'MERCADERIA ACCESORIO': '4.1.01.008.0000',
};

@Injectable()
export class VtaComprobanteAsientoService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CntAsiento)
    private readonly asientoRepo: Repository<CntAsiento>,
    @InjectRepository(CntMovimiento)
    private readonly movRepo: Repository<CntMovimiento>,
    @InjectRepository(VtaComprobante)
    private readonly compRepo: Repository<VtaComprobante>,
    @InjectRepository(VtaComprobanteAsiento)
    private readonly linkRepo: Repository<VtaComprobanteAsiento>,
  ) {}

  // Genera cnt_asiento + cnt_movimiento y vincula en vta_comprobante_asiento
  async createAsientoForComprobante(
    tipo: string,
    comprobante: string,
    metodoPago?: string,
  ): Promise<{ ejercicio: string; asientoId: number }> {
    const comp = await this.compRepo.findOne({
      where: { tipo, comprobante },
    });

    if (!comp) {
      throw new NotFoundException(
        `Comprobante ${tipo} ${comprobante} no encontrado`,
      );
    }

    const total = Number(comp.total ?? 0);

    const fechaStr = comp.fecha
      ? new Date(comp.fecha).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const items: Array<{
        item: string;
        rubro: string | null;
        importe: string | null;
        iva: string | null;
      }> = await qr.query(
        `SELECT ci.item, COALESCE(NULLIF(ci.rubro, ''), i.rubro) AS rubro,
                ci.importe, ci.iva
         FROM vta_comprobante_item ci
         LEFT JOIN stk_item i ON i.id = ci.item
         WHERE ci.tipo = ? AND ci.comprobante = ?
         ORDER BY ci.linea`,
        [tipo, comprobante],
      );
      const totalCentavos = Math.round(total * 100);
      const ivaCentavos = Math.round(Number(comp.iva ?? 0) * 100);
      if (
        !Number.isSafeInteger(totalCentavos) ||
        !Number.isSafeInteger(ivaCentavos) ||
        totalCentavos <= 0 ||
        ivaCentavos < 0 ||
        ivaCentavos > totalCentavos ||
        !items.length
      ) {
        throw new BadRequestException(
          'Importes o items invalidos para el asiento',
        );
      }

      const haberes = new Map<string, number>();
      let ivaItems = 0;
      for (const item of items) {
        const importe = Math.round(Number(item.importe) * 100);
        const iva = Math.round(Number(item.iva ?? 0) * 100);
        if (
          item.importe == null ||
          !Number.isSafeInteger(importe) ||
          !Number.isSafeInteger(iva) ||
          importe < 0 ||
          iva < 0 ||
          iva > importe
        ) {
          throw new BadRequestException(
            `Importe invalido para item ${item.item}`,
          );
        }
        ivaItems += iva;
        if (importe === 0) continue;
        const cuenta = CUENTAS_VENTA[item.rubro?.trim() ?? ''];
        if (!cuenta) {
          throw new BadRequestException(
            `Sin cuenta de ventas para item ${item.item}, rubro ${item.rubro ?? 'sin rubro'}`,
          );
        }
        // El importe del item ya incluye descuentos y no incluye el IVA de la factura.
        haberes.set(cuenta, (haberes.get(cuenta) ?? 0) + importe);
      }
      const diferencia =
        totalCentavos -
        ivaCentavos -
        [...haberes.values()].reduce((suma, importe) => suma + importe, 0);
      if (
        ivaItems !== ivaCentavos ||
        Math.abs(diferencia) > 1 ||
        !haberes.size
      ) {
        throw new BadRequestException(
          'El detalle del Haber no coincide con el total del comprobante',
        );
      }
      // Absorber un centavo de redondeo en la cuenta de ventas de mayor importe.
      const cuentaMayor = [...haberes].sort((a, b) => b[1] - a[1])[0][0];
      haberes.set(cuentaMayor, haberes.get(cuentaMayor)! + diferencia);
      if (ivaCentavos) haberes.set('2.1.04.001.0000', ivaCentavos);

      // 1) Resolver ejercicio contable real por fecha (Opción B)
      const rows: Array<{ id: string }> = await qr.query(
        `SELECT id
       FROM cnt_ejercicio
       WHERE ? BETWEEN fecha_desde AND fecha_hasta
       LIMIT 1`,
        [fechaStr],
      );

      const ejercicio = rows?.[0]?.id;
      if (!ejercicio) {
        throw new NotFoundException(
          `No existe ejercicio contable para fecha ${fechaStr} (cnt_ejercicio)`,
        );
      }

      // 2) Calcular próximo id/numero de asiento para ese ejercicio (misma TX)
      const result = (await qr.manager
        .createQueryBuilder(CntAsiento, 'a')
        .select('COALESCE(MAX(a.id), 0) + 1', 'next')
        .where('a.ejercicio = :ejercicio', { ejercicio })
        .getRawOne()) as { next: number } | undefined;

      const next = Number(result?.next ?? 1);

      // 3) Crear asiento
      const asiento: CntAsiento = this.asientoRepo.create({
        ejercicio,
        id: next,
        numero: next,
        fecha: fechaStr,
        imputacion: null,
        leyenda: `${
          comp.periodo ??
          `${String(new Date().getMonth() + 1).padStart(2, '0')}/${ejercicio}`
        } Venta N° ${comp.comprobante}`,
        saldo_debe: total.toFixed(2) as any,
        saldo_haber: total.toFixed(2) as any,
        tipo: null,
        moneda: (comp as any)['moneda'] ?? null,
        cotizacion: '1.0000' as any,
        proyecto: null,
        empresa: null,
        ejercicio_union: null,
        asiento_union: null,
        visible: true,
      });

      await qr.manager.save(CntAsiento, asiento);

      // 4) Movimientos: usar cuenta diferente según método de pago
      // Para online (Nave): 1.1.01.005.0001 (valores a depositar - Nave)
      // Para transferencias: 1.1.03.001.0000 (deudores por venta)
      const cuentaDebe =
        metodoPago === 'online'
          ? '1.1.01.005.0001'
          : metodoPago === 'transfer'
            ? '1.1.03.001.0000'
            : '1.1.01.001.0000';

      const movs: Partial<CntMovimiento>[] = [
        ...[...haberes]
          .filter(([, importe]) => importe !== 0)
          .map(([cuenta, importe], index) => ({
            ejercicio,
            asiento: asiento.id,
            numero: index + 1,
            cuenta,
            debe: null,
            haber: (importe / 100) as any,
            leyenda: null,
            proyecto: null,
          })),
        {
          ejercicio,
          asiento: asiento.id,
          numero:
            [...haberes.values()].filter((importe) => importe !== 0).length + 1,
          cuenta: cuentaDebe, // Debe - Deudores por venta o Caja/Banco
          debe: total as any,
          haber: null,
          leyenda: null,
          proyecto: null,
        },
      ];

      await qr.manager.save(CntMovimiento, movs as any);

      // 5) Link vta_comprobante_asiento
      const link = this.linkRepo.create({
        tipo,
        comprobante,
        ejercicio,
        asiento: asiento.id,
      });

      await qr.manager.save(VtaComprobanteAsiento, link);

      await qr.commitTransaction();
      return { ejercicio, asientoId: asiento.id };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  create(createVtaComprobanteAsientoDto: CreateVtaComprobanteAsientoDto) {
    return 'This action adds a new vtaComprobanteAsiento';
  }

  findAll() {
    return `This action returns all vtaComprobanteAsiento`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vtaComprobanteAsiento`;
  }

  update(
    id: number,
    updateVtaComprobanteAsientoDto: UpdateVtaComprobanteAsientoDto,
  ) {
    return `This action updates a #${id} vtaComprobanteAsiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaComprobanteAsiento`;
  }
}
