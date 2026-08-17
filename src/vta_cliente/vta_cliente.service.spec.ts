import { VtaClienteService } from './vta_cliente.service';
import { CreateVtaClienteDto } from './dto/create-vta_cliente.dto';

describe('VtaClienteService', () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
    update: jest.fn(async () => undefined),
  };
  const direccionLinkRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => ({ affected: 1 })),
  };

  let service: VtaClienteService;

  beforeEach(() => {
    jest.clearAllMocks();
    direccionLinkRepo.find.mockResolvedValue([]);
    direccionLinkRepo.findOne.mockResolvedValue(null);
    service = new VtaClienteService(repo as any, direccionLinkRepo as any);
  });

  describe('findOne -> direccionSeparada', () => {
    it('mapea las columnas del ERP a la misma forma que /maps/distance', async () => {
      repo.findOne.mockResolvedValue({
        id: '20432802281',
        direccion: 'Jujuy 984 4',
        localidad: '4° Seccion - Capital',
        provincia: 'Mendoza',
        cpa: 'M5502HAN',
        pais: null,
      });

      const cliente = await service.findOne('20432802281');

      expect(cliente?.direccionSeparada).toEqual({
        calle: 'Jujuy',
        numero: '984 4',
        ciudad: '4° Seccion - Capital',
        provincia: 'Mendoza',
        codigoPostal: '5502',
        pais: 'Argentina',
      });
    });

    it('no confunde el número del nombre de la calle con la altura', async () => {
      repo.findOne.mockResolvedValue({
        id: '1',
        direccion: '9 de Julio 1779',
        localidad: 'Mendoza',
        provincia: 'Mendoza',
        cpa: '5500',
        pais: null,
      });

      const cliente = await service.findOne('1');

      expect(cliente?.direccionSeparada).toMatchObject({
        calle: '9 de Julio',
        numero: '1779',
      });
    });

    it('usa el pais guardado cuando existe y no rompe con columnas vacías', async () => {
      repo.findOne.mockResolvedValue({
        id: '20432802281',
        direccion: null,
        localidad: null,
        provincia: null,
        cpa: null,
        pais: 'Chile',
      });

      const cliente = await service.findOne('20432802281');

      expect(cliente?.direccionSeparada).toEqual({
        calle: '',
        numero: '',
        ciudad: '',
        provincia: '',
        codigoPostal: '',
        pais: 'Chile',
      });
    });

    it('devuelve null cuando el cliente no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.findOne('999')).toBeNull();
    });
  });

  describe('normalización al crear', () => {
    const crear = async (dto: Partial<CreateVtaClienteDto>) => {
      repo.findOne.mockResolvedValue(null);
      await service.findOrCreateOrUpdate(dto as CreateVtaClienteDto);
      return repo.save.mock.calls[0][0];
    };

    it('saca el código de país duplicado del teléfono y guarda 549...', async () => {
      const saved = await crear({
        id: '20432802281',
        telefono: '+549 54 2612533669',
      });
      expect(saved.telefono).toBe('5492612533669');
      expect(saved.contacto).toBe('5492612533669');
    });

    it('acorta el CPA extendido a 4 dígitos', async () => {
      const saved = await crear({ id: '20432802281', cpa: 'M5539 Las Heras' });
      expect(saved.cpa).toBe('5539');
    });

    it('usa CUIL por defecto para consumidor final', async () => {
      const saved = await crear({ id: '20432802281' });
      expect(saved.tipoDocumento).toBe('CUIL');
    });
  });

  describe('link de direccion', () => {
    it('guarda un unico link por cliente y sobreescribe por clienteId', async () => {
      const saved = await service.saveDireccionLink('20432802281', {
        link: 'https://maps.app.goo.gl/test',
        direccionTexto: ' Jujuy 984 ',
        etiqueta: ' Casa ',
      });

      expect(direccionLinkRepo.update).not.toHaveBeenCalled();
      expect(saved).toMatchObject({
        clienteId: '20432802281',
        link: 'https://maps.app.goo.gl/test',
        direccionTexto: 'Jujuy 984',
        etiqueta: 'Casa',
      });
    });
  });
});
