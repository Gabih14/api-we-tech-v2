import { getMetadataArgsStorage } from 'typeorm';
import { VtaCobroMedio } from './vta-cobro-medio.entity';

describe('esquema de modos de cobro del ERP', () => {
  const storage = getMetadataArgsStorage();
  const columnFor = (propertyName: string) =>
    storage.columns.find(
      (metadata) =>
        metadata.target === VtaCobroMedio &&
        metadata.propertyName === propertyName,
    );

  it('usa la tabla renombrada vta_cobro_modo', () => {
    const table = storage.tables.find(
      (metadata) => metadata.target === VtaCobroMedio,
    );

    expect(table?.name).toBe('vta_cobro_modo');
  });

  it('mapea los nombres actuales de sus columnas', () => {
    expect(columnFor('modalidad')?.options.name).toBe('modo');
    expect(columnFor('cheque_3ro')?.options.name).toBe('cheque3ro');
    expect(columnFor('cobroACuenta')?.options.name).toBe('cobroacuenta');
    expect(columnFor('detalle')?.options.name).toBe('leyenda');
    expect(columnFor('anulado')?.options.name).toBe('anulado');
    expect(columnFor('importe')?.options.precision).toBe(17);
  });

  it('usa el valor CHEQUE3RO definido por el enum nuevo', () => {
    expect(columnFor('modalidad')?.options.enum).toContain('CHEQUE3RO');
    expect(columnFor('modalidad')?.options.enum).not.toContain('CHEQUE_3RO');
  });
});
