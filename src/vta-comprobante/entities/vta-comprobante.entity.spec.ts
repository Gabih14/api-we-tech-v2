import { getMetadataArgsStorage } from 'typeorm';
import { VtaComprobanteItem } from '../../vta-comprobante-item/entities/vta-comprobante-item.entity';
import { VtaComprobante } from './vta-comprobante.entity';

describe('esquema de comprobantes del ERP', () => {
  const columnsFor = (target: Function) =>
    getMetadataArgsStorage().columns.filter(
      (metadata) => metadata.target === target,
    );

  const columnFor = (target: Function, propertyName: string) =>
    columnsFor(target).find(
      (metadata) => metadata.propertyName === propertyName,
    );

  const databaseNamesFor = (target: Function) =>
    columnsFor(target).map(
      (metadata) => metadata.options.name ?? metadata.propertyName,
    );

  it('mapea los nombres actuales de vta_comprobante', () => {
    expect(columnFor(VtaComprobante, 'observaciones')?.options.name).toBe(
      'notas',
    );
    expect(columnFor(VtaComprobante, 'observaciones_int')?.options.name).toBe(
      'notas_int',
    );
    expect(columnFor(VtaComprobante, 'anclar_precio')?.options.name).toBe(
      'anclar_iva',
    );
    expect(columnFor(VtaComprobante, 'comisionliq')?.options.name).toBe(
      'comisionx',
    );
    expect(columnFor(VtaComprobante, 'condicion_venta')?.options.name).toBe(
      'condventa',
    );
    expect(columnFor(VtaComprobante, 'ajuste_neto')?.options.name).toBe(
      'ajuste$',
    );
    expect(columnFor(VtaComprobante, 'ajuste_iva')?.options.name).toBe(
      'ajuste$iva',
    );
    expect(columnFor(VtaComprobante, 'user')?.options.name).toBe('usuario');
  });

  it('ya no declara columnas eliminadas de vta_comprobante', () => {
    expect(databaseNamesFor(VtaComprobante)).not.toEqual(
      expect.arrayContaining([
        'comprobante_aux',
        'comprobante_adj',
        'ajuste_financiero',
        'ajuste_calculo',
        'sucursal',
        'existencia_flujo',
        'prorrateo',
        'costo_financiero',
      ]),
    );
  });

  it('mapea los importes ajustados de vta_comprobante_item', () => {
    expect(columnFor(VtaComprobanteItem, 'ajuste_neto')?.options.name).toBe(
      'ajuste$',
    );
    expect(columnFor(VtaComprobanteItem, 'ajuste_iva')?.options.name).toBe(
      'ajuste$iva',
    );
    expect(columnFor(VtaComprobanteItem, 'cantidad')?.options.precision).toBe(
      13,
    );
    expect(columnFor(VtaComprobanteItem, 'importe')?.options.precision).toBe(
      17,
    );
  });
});
