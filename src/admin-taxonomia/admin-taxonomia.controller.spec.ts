import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AUTH_TYPE_KEY } from '../common/decorators/auth-type.decorator';
import { AdminTaxonomiaController } from './admin-taxonomia.controller';
import { CreateAtributoDto } from './dto/create-atributo.dto';
import { ListArbolesDto } from './dto/list-arboles.dto';
import { UpdateAtributoDto } from './dto/update-atributo.dto';

describe('AdminTaxonomiaController', () => {
  it.each([
    AdminTaxonomiaController.prototype.listarArboles,
    AdminTaxonomiaController.prototype.obtenerArbol,
    AdminTaxonomiaController.prototype.listarAtributos,
    AdminTaxonomiaController.prototype.obtenerAtributo,
    AdminTaxonomiaController.prototype.preview,
    AdminTaxonomiaController.prototype.auditar,
  ])('protege lecturas y preview con read', (handler) => {
    expect(Reflect.getMetadata(AUTH_TYPE_KEY, handler)).toBe('read');
  });

  it.each([
    AdminTaxonomiaController.prototype.crearAtributo,
    AdminTaxonomiaController.prototype.actualizarAtributo,
    AdminTaxonomiaController.prototype.reemplazar,
    AdminTaxonomiaController.prototype.eliminar,
  ])('protege escrituras con write', (handler) => {
    expect(Reflect.getMetadata(AUTH_TYPE_KEY, handler)).toBe('write');
  });
});

describe('DTOs de taxonomia administrativa', () => {
  it('transforma paginacion y acepta filtros del listado de arboles', async () => {
    const dto = plainToInstance(ListArbolesDto, {
      page: '2',
      limit: '50',
      search: '  PLA  ',
      tipo: 'padre',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, limit: 50, search: 'PLA' });
  });

  it('valida longitudes al crear atributos', async () => {
    const dto = plainToInstance(CreateAtributoDto, {
      id: 'ID-DEMASIADO-LARGO',
      nombre: 'Nombre',
      clase: 'Material',
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('no permite cambiar el id mediante el DTO de edicion', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { id: 'OTRO', nombre: 'Nuevo' },
        { type: 'body', metatype: UpdateAtributoDto },
      ),
    ).rejects.toBeDefined();
  });
});
