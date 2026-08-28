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

  it('mapea los nombres actuales de vta_cobro', () => {
    expect(columnFor('comision$')?.options.name).toBe('comision$');
    expect(columnFor('comisionliq')?.options.name).toBe('comisionx');
    expect(columnFor('cargos$')?.options.name).toBe('cargos$');
    expect(columnFor('estado')?.options.name).toBe('estado');
  });
});
