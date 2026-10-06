import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateStkAtributoClasificacionDto } from './update-stk-atributo-clasificacion.dto';

describe('UpdateStkAtributoClasificacionDto', () => {
  it('recorta los valores y convierte strings vacíos a null', async () => {
    const dto = plainToInstance(UpdateStkAtributoClasificacionDto, {
      grupo: '  PLA  ',
      subgrupo: '   ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual({ grupo: 'PLA', subgrupo: null });
  });

  it('acepta null para quitar la clasificación', async () => {
    const dto = plainToInstance(UpdateStkAtributoClasificacionDto, {
      grupo: null,
      subgrupo: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
