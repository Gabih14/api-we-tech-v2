import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ArgumentMetadata } from '@nestjs/common/interfaces';
import { Test } from '@nestjs/testing';
import { CreateEsperaDto } from './dto/create-espera.dto';
import { EsperaController } from './espera.controller';
import { EsperaService } from './espera.service';

describe('EsperaController DTO validation', () => {
  let controller: EsperaController;
  let validationPipe: ValidationPipe;
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateEsperaDto,
    data: '',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EsperaController],
      providers: [
        {
          provide: EsperaService,
          useValue: {
            crear: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(EsperaController);
    validationPipe = new ValidationPipe({ transform: true, whitelist: true });
  });

  it('se instancia correctamente', () => {
    expect(controller).toBeDefined();
  });

  it('rechaza cantidad menor a 1', async () => {
    await expect(
      validationPipe.transform(
        {
          producto_id: 'G3-PLA1-1KG-NEGR',
          cliente_nombre: 'Federico Polizzi',
          cantidad: 0,
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['producto_id', { cliente_nombre: 'Federico Polizzi' }],
    ['cliente_nombre', { producto_id: 'G3-PLA1-1KG-NEGR' }],
  ])('rechaza body sin %s', async (_field, body) => {
    await expect(validationPipe.transform(body, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
