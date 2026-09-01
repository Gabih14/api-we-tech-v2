import { getMetadataArgsStorage } from 'typeorm';
import { VtaCobro } from './vta-cobro.entity';

describe('esquema de cobros del ERP', () => {
  const columnsFor = (target: Function) =>
    getMetadataArgsStorage().columns.filter(
      (metadata) => metadata.target === target,
    );

  const columnFor = (propertyName: string) =>
    columnsFor(VtaCobro).find(
      (metadata) => metadata.propertyName === propertyName,
    );

  const databaseNames = () =>
    columnsFor(VtaCobro).map(
      (metadata) => metadata.options.name ?? metadata.propertyName,
    );

  it('mapea los nombres actuales de vta_cobro', () => {
    expect(columnFor('comision$')?.options.name).toBe('comision$');
    expect(columnFor('comisionliq')?.options.name).toBe('comisionx');
    expect(columnFor('cargos$')?.options.name).toBe('cargos$');
    expect(columnFor('estado')?.options.name).toBe('estado');
    expect(columnFor('observaciones')?.options.name).toBe('notas');
    expect(columnFor('observacionesInt')?.options.name).toBe('notas_int');
    expect(columnFor('cheque_3ro')?.options.name).toBe('cheque3ro');
    expect(columnFor('user')?.options.name).toBe('usuario');
    expect(columnFor('imputacion')?.options.name).toBe('imputacion');
    expect(columnFor('nivel')?.options.name).toBe('nivel');
  });

  it('usa la precisión y tipos de la estructura actual', () => {
    for (const propertyName of [
      'caja',
      'cuenta',
      'tarjeta',
      'cheque',
      'cheque_3ro',
      'certificado',
      'ctacte',
      'total',
      'subtotalFactura',
      'totalFactura',
      'ajusteTotal',
      'cargos$',
    ]) {
      expect(columnFor(propertyName)?.options.precision).toBe(17);
    }

    for (const propertyName of [
      'adjuntos',
      'adjuntado',
      'mail',
      'visible',
    ]) {
      expect(columnFor(propertyName)?.mode).toBe('regular');
      expect(columnFor(propertyName)?.options.type).toBe('tinyint');
    }
  });

  it('no intenta consultar los nombres eliminados', () => {
    expect(databaseNames()).not.toEqual(
      expect.arrayContaining([
        'observaciones',
        'observaciones_int',
        'cheque_3ro',
        'user',
      ]),
    );
  });
});
