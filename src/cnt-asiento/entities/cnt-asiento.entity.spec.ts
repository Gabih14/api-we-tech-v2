import { getMetadataArgsStorage } from 'typeorm';
import { CntAsiento } from './cnt-asiento.entity';

describe('CntAsiento entity', () => {
  it('no consulta la columna eliminada union_asiento', () => {
    const columnas = getMetadataArgsStorage()
      .columns.filter((metadata) => metadata.target === CntAsiento)
      .map((metadata) => metadata.options.name ?? metadata.propertyName);

    expect(columnas).not.toContain('union_asiento');
  });
});
