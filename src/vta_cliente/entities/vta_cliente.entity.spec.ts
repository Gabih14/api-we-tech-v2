import { getMetadataArgsStorage } from 'typeorm';
import { VtaCliente } from './vta_cliente.entity';

describe('VtaCliente entity', () => {
  const column = (propertyName: keyof VtaCliente) =>
    getMetadataArgsStorage().columns.find(
      (metadata) =>
        metadata.target === VtaCliente &&
        metadata.propertyName === propertyName,
    );

  it('mapea observaciones de la API a la columna notas del ERP', () => {
    expect(column('observaciones')?.options.name).toBe('notas');
  });

  it('respeta el tipo y los limites del esquema actual', () => {
    expect(column('rubro')?.options.length).toBe(30);
    expect(column('visible')?.options.type).toBe('tinyint');
    expect(column('visible')?.options.default).toBe(1);
  });
});
