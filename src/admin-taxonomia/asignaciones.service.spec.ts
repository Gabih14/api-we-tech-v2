import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StkAtributo } from '../stk-item/entities/stk-atributo.entity';
import { StkAtributoNodo } from '../stk-item/entities/stk-atributo-nodo.entity';
import { StkItem } from '../stk-item/entities/stk-item.entity';
import { AsignacionesService } from './asignaciones.service';

describe('AsignacionesService', () => {
  const emptyState = {
    atributosDirectos: [],
    atributosEfectivos: [],
    duplicadosDirectos: [],
    duplicadosEfectivos: [],
    nodosInvalidos: [],
  };
  const normalizarClase = (value: string) => value.trim().toLowerCase();

  it('preview valida la clase y no inicia una transaccion', async () => {
    const transaction = jest.fn();
    const manager = managerFor({
      item: { id: 'ARBOL', idPadre: null },
      atributo: { id: 'WEBTEC', clase: 'Material', nombre: 'Tecnico' },
    });
    const service = new AsignacionesService(
      { manager, transaction } as never,
      {
        resolver: jest.fn().mockResolvedValue(emptyState),
        normalizarClase,
      } as never,
    );

    await expect(
      service.preview('ARBOL', 'Grupo Web', 'WEBTEC'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('preview rechaza un atributo inexistente', async () => {
    const manager = managerFor({
      item: { id: 'ARBOL', idPadre: null },
      atributo: null,
    });
    const service = new AsignacionesService(
      { manager } as never,
      { resolver: jest.fn(), normalizarClase } as never,
    );

    await expect(
      service.preview('ARBOL', 'Grupo Web', 'NOEXISTE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preview rechaza un arbol inexistente', async () => {
    const manager = managerFor({ item: null, atributo: null });
    const service = new AsignacionesService(
      { manager } as never,
      { resolver: jest.fn(), normalizarClase } as never,
    );

    await expect(
      service.preview('NOEXISTE', 'Grupo Web', 'WEBTEC'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preview informa duplicados sin modificar la base', async () => {
    const directos = [adminAttribute('WEBEST'), adminAttribute('WEBDEC')];
    const manager = managerFor({
      item: { id: 'ARBOL', idPadre: null },
      atributo: { id: 'WEBTEC', clase: 'Grupo Web', nombre: 'Tecnico' },
      affectedVariants: 13,
    });
    const service = new AsignacionesService(
      { manager, transaction: jest.fn() } as never,
      {
        resolver: jest.fn().mockResolvedValue({
          ...emptyState,
          atributosDirectos: directos,
          atributosEfectivos: directos,
        }),
        normalizarClase,
      } as never,
    );

    await expect(
      service.preview('ARBOL', 'Grupo Web', 'WEBTEC'),
    ).resolves.toMatchObject({
      nuevo: { id: 'WEBTEC' },
      variantesAfectadas: 13,
      duplicadosQueSeEliminarian: directos,
    });
  });

  it('reemplaza dentro de una transaccion usando la convencion del nodo', async () => {
    const transactionalManager = managerFor({
      item: { id: 'ARBOL', idPadre: null },
      atributo: { id: 'WEBTEC', clase: 'Grupo Web', nombre: 'Tecnico' },
      affectedVariants: 2,
    });
    const insertNode = (
      transactionalManager.getRepository(StkAtributoNodo) as any
    ).insert;
    const finalItemRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'ARBOL', idPadre: null }),
    };
    const dataSource = {
      manager: transactionalManager,
      transaction: jest.fn(async (work) => work(transactionalManager)),
      getRepository: jest.fn((entity) =>
        entity === StkItem ? finalItemRepository : undefined,
      ),
    };
    const resolver = {
      resolver: jest.fn().mockResolvedValue(emptyState),
      normalizarClase,
    };
    const service = new AsignacionesService(
      dataSource as never,
      resolver as never,
    );

    const result = await service.reemplazar('ARBOL', 'Grupo Web', 'WEBTEC');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(insertNode).toHaveBeenCalledWith({
      arbol: 'ARBOL',
      camino: 'WEBTEC',
      atributo: 'WEBTEC',
      atributoPadre: null,
    });
    expect(result).toMatchObject({
      nuevo: { id: 'WEBTEC' },
      estadoFinal: emptyState,
    });
  });

  it('al eliminar un override devuelve el atributo heredado que reaparece', async () => {
    const direct = adminAttribute('WEBTEC', false, 'HIJO');
    const inherited = adminAttribute('WEBEST', true, 'PADRE');
    const manager = managerFor({
      item: { id: 'HIJO', idPadre: 'PADRE' },
      atributo: null,
    });
    const resolver = {
      resolver: jest
        .fn()
        .mockResolvedValueOnce({ ...emptyState, atributosDirectos: [direct] })
        .mockResolvedValueOnce({
          ...emptyState,
          atributosEfectivos: [inherited],
        }),
      normalizarClase,
    };
    const dataSource = {
      manager,
      transaction: jest.fn(async (work) => work(manager)),
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue({ id: 'HIJO', idPadre: 'PADRE' }),
      })),
    };
    const service = new AsignacionesService(
      dataSource as never,
      resolver as never,
    );

    await expect(service.eliminar('HIJO', 'Grupo Web')).resolves.toMatchObject({
      eliminado: 'WEBTEC',
      valorEfectivoActual: { atributoId: 'WEBEST', heredado: true },
    });
  });
});

function managerFor({
  item,
  atributo,
  affectedVariants = 0,
}: {
  item: { id: string; idPadre: string | null } | null;
  atributo: { id: string; clase: string; nombre: string } | null;
  affectedVariants?: number;
}) {
  const lockQuery = fluent({
    getOne: jest.fn().mockResolvedValue(item),
    getCount: jest.fn().mockResolvedValue(affectedVariants),
  });
  const countQuery = fluent({
    getCount: jest.fn().mockResolvedValue(affectedVariants),
  });
  const itemRepository = {
    findOne: jest.fn().mockResolvedValue(item),
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(lockQuery)
      .mockReturnValue(countQuery),
  };
  const atributoRepository = {
    findOneBy: jest.fn().mockResolvedValue(atributo),
  };
  const nodeRepository = { insert: jest.fn().mockResolvedValue({}) };
  const writeBuilder = fluent({ execute: jest.fn().mockResolvedValue({}) });
  return {
    getRepository: jest.fn((entity) => {
      if (entity === StkItem) return itemRepository;
      if (entity === StkAtributo) return atributoRepository;
      if (entity === StkAtributoNodo) return nodeRepository;
      return {};
    }),
    createQueryBuilder: jest.fn(() => writeBuilder),
  };
}

function fluent(extra: Record<string, jest.Mock>) {
  const value: Record<string, jest.Mock> = { ...extra };
  for (const method of [
    'setLock',
    'where',
    'andWhere',
    'insert',
    'into',
    'values',
    'orIgnore',
    'delete',
    'from',
  ]) {
    value[method] = jest.fn(() => value);
  }
  return value;
}

function adminAttribute(id: string, heredado = false, arbolOrigen = 'ARBOL') {
  return {
    atributoId: id,
    nombre: id,
    clase: 'Grupo Web',
    grupo: null,
    subgrupo: null,
    grupoAtributo: null,
    subgrupoAtributo: null,
    orden: 1,
    heredado,
    arbolOrigen,
    camino: id,
  };
}
