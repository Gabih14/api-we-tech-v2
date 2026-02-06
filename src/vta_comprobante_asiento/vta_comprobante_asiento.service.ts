import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateVtaComprobanteAsientoDto } from './dto/create-vta_comprobante_asiento.dto';
import { UpdateVtaComprobanteAsientoDto } from './dto/update-vta_comprobante_asiento.dto';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';
import { CntMovimiento } from 'src/cnt-movimiento/entities/cnt-movimiento.entity';
import { VtaComprobante } from 'src/vta-comprobante/entities/vta-comprobante.entity';
import { VtaComprobanteAsiento } from './entities/vta_comprobante_asiento.entity';

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
    throw new NotFoundException(`Comprobante ${tipo} ${comprobante} no encontrado`);
  }

  const total = Number(comp.total ?? 0);

  const fechaStr = comp.fecha
    ? new Date(comp.fecha).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const qr = this.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
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
        comp.periodo ?? `${String(new Date().getMonth() + 1).padStart(2, '0')}/${ejercicio}`
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
      union_asiento: false,
      visible: true,
    });

    await qr.manager.save(CntAsiento, asiento);

    // 4) Movimientos: usar cuenta diferente según método de pago
    // Para transferencias: 1.1.03.001.0000 (deudores por venta)
    // Para online (Nave): 1.1.01.001.0000 (caja/banco)
    const cuentaDebe = metodoPago === 'transfer' ? '1.1.03.001.0000' : '1.1.01.001.0000';

    const movs: Partial<CntMovimiento>[] = [
      {
        ejercicio,
        asiento: asiento.id,
        numero: 1,
        cuenta: '1.1.05.001.0000', // Haber - Ventas
        debe: null,
        haber: total as any,
        leyenda: null,
        proyecto: null,
      },
      {
        ejercicio,
        asiento: asiento.id,
        numero: 2,
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

  update(id: number, updateVtaComprobanteAsientoDto: UpdateVtaComprobanteAsientoDto) {
    return `This action updates a #${id} vtaComprobanteAsiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} vtaComprobanteAsiento`;
  }
}
