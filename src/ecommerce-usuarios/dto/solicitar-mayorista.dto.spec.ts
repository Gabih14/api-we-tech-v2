import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FiguraFiscalComercial,
  OfertaPublico,
  PerfilCompraInicial,
  SedeComercial,
} from '../entities/ecommerce-usuario.entity';
import { SolicitarMayoristaDto } from './solicitar-mayorista.dto';

const solicitudValida = {
  nombreComercio: 'Impresiones Cuyo',
  personaResponsable: 'Ana Perez',
  ubicacionZona: 'Godoy Cruz, Mendoza',
  telefono: '2615551234',
  figuraFiscalComercial: FiguraFiscalComercial.EMPRENDEDOR_MONOTRIBUTISTA,
  perfilCompraInicial: PerfilCompraInicial.GRAN_CONSUMIDOR_FINAL_96_239_KG,
  sedeComercial: SedeComercial.TALLER_OFICINA,
  ofertasPublico: [OfertaPublico.SERVICIO_IMPRESION_3D],
};

describe('SolicitarMayoristaDto', () => {
  it('acepta una solicitud con las opciones validas', async () => {
    const dto = plainToInstance(SolicitarMayoristaDto, solicitudValida);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('exige las marcas si actualmente vende filamentos', async () => {
    const dto = plainToInstance(SolicitarMayoristaDto, {
      ...solicitudValida,
      ofertasPublico: [OfertaPublico.VENTA_ACTUAL_FILAMENTOS],
    });

    const errors = await validate(dto);

    expect(errors.some(({ property }) => property === 'marcasFilamento')).toBe(
      true,
    );
  });

  it('rechaza opciones no contempladas y actividades duplicadas', async () => {
    const dto = plainToInstance(SolicitarMayoristaDto, {
      ...solicitudValida,
      perfilCompraInicial: 'OTRO',
      ofertasPublico: [
        OfertaPublico.CURSOS_TALLERES,
        OfertaPublico.CURSOS_TALLERES,
      ],
    });

    const errors = await validate(dto);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'ofertasPublico',
      'perfilCompraInicial',
    ]);
  });
});
