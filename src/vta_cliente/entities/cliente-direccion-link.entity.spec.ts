import { getMetadataArgsStorage } from 'typeorm';
import { ClienteDireccionLink } from './cliente-direccion-link.entity';

describe('ClienteDireccionLink entity', () => {
  const column = (propertyName: keyof ClienteDireccionLink) =>
    getMetadataArgsStorage().columns.find(
      (metadata) =>
        metadata.target === ClienteDireccionLink &&
        metadata.propertyName === propertyName,
    );

  it('mapea la tabla de links de direccion de clientes', () => {
    expect(column('clienteId')?.options.name).toBe('cliente_id');
    expect(column('link')?.options.length).toBe(1024);
    expect(column('direccionTexto')?.options.name).toBe('direccion_texto');
  });
});
