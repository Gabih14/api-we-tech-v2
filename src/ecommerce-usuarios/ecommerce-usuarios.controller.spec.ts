import { EcommerceUsuariosController } from './ecommerce-usuarios.controller';
import { EcommerceUsuariosService } from './ecommerce-usuarios.service';
import { EstadoMayorista } from './entities/ecommerce-usuario.entity';

describe('EcommerceUsuariosController', () => {
  it('delega el listado paginado al servicio', async () => {
    const result = {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const findAll = jest.fn().mockResolvedValue(result);
    const service = { findAll } as unknown as EcommerceUsuariosService;
    const controller = new EcommerceUsuariosController(service);
    const query = { page: 1, limit: 20 };

    await expect(controller.listar(query)).resolves.toBe(result);
    expect(findAll).toHaveBeenCalledWith(query);
  });

  it('delega la consulta por id al servicio', async () => {
    const user = { id: 7 };
    const findOneById = jest.fn().mockResolvedValue(user);
    const service = { findOneById } as unknown as EcommerceUsuariosService;
    const controller = new EcommerceUsuariosController(service);

    await expect(controller.obtenerPorId(7)).resolves.toBe(user);
    expect(findOneById).toHaveBeenCalledWith(7);
  });

  it('delega el cambio de estado validado al servicio', async () => {
    const updated = { id: 7, estadoMayorista: EstadoMayorista.APROBADO };
    const updateEstadoMayorista = jest.fn().mockResolvedValue(updated);
    const service = {
      updateEstadoMayorista,
    } as unknown as EcommerceUsuariosService;
    const controller = new EcommerceUsuariosController(service);

    await expect(
      controller.actualizarEstado(7, { estado: EstadoMayorista.APROBADO }),
    ).resolves.toBe(updated);
    expect(updateEstadoMayorista).toHaveBeenCalledWith(
      7,
      EstadoMayorista.APROBADO,
    );
  });
});
