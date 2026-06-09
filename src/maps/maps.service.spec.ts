import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MapsService } from './maps.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MapsService', () => {
  let service: MapsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new MapsService({
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_API_KEY') return 'google-key';
        return undefined;
      }),
    } as unknown as ConfigService);
  });

  it('rechaza direcciones resueltas solo como zona administrativa', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: 'Las Heras, Mendoza Province, Argentina',
            place_id: 'las-heras-place',
            types: ['administrative_area_level_2', 'political'],
            address_components: [
              { types: ['administrative_area_level_2', 'political'] },
            ],
          },
        ],
      },
    });

    const result = await service.getDistanceToDestination(
      'Calle inexistente 123',
      'Las Heras, Mendoza',
    );

    expect(result).toEqual({
      error: 'La dirección es demasiado imprecisa',
      detail:
        'No se pudo identificar calle y altura. Revisá la dirección antes de calcular el envío.',
      needsMoreSpecificAddress: true,
      destinationResolved: 'Las Heras, Mendoza Province, Argentina',
    });
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('calcula distancia cuando Google resuelve calle y altura', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [
            {
              formatted_address: 'Av. San Martin 123, Las Heras, Mendoza',
              place_id: 'street-place',
              types: ['street_address'],
              address_components: [
                { types: ['street_number'] },
                { types: ['route'] },
              ],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'OK',
          origin_addresses: ['We Tech'],
          destination_addresses: ['Av. San Martin 123'],
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: { text: '4.2 km', value: 4200 },
                  duration: { text: '10 mins', value: 600 },
                },
              ],
            },
          ],
        },
      });

    const result = await service.getDistanceToDestination(
      'Av. San Martin 123',
      'Las Heras, Mendoza',
    );

    expect(result).toMatchObject({
      distance: '4.2 km',
      duration: '10 mins',
      destinationResolved: 'Av. San Martin 123, Las Heras, Mendoza',
      originResolved: 'We Tech',
    });
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get.mock.calls[1][0]).toContain(
      'destinations=place_id%3Astreet-place',
    );
  });

  it('usa provincia, pais y codigo postal para resolver destinos ambiguos', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: 'Chile 2069, Mendoza, Argentina',
            place_id: 'mendoza-street-place',
            types: ['street_address'],
            address_components: [
              { types: ['street_number'] },
              { types: ['route'] },
            ],
          },
        ],
      },
    });

    await service.getDistanceToDestination('Chile 2069', 'Mendoza', {
      province: 'Mendoza',
      country: 'Argentina',
      postalCode: '5500',
    });

    const geocodeUrl = mockedAxios.get.mock.calls[0][0];
    expect(decodeURIComponent(geocodeUrl)).toContain(
      'address=Chile 2069, Mendoza, Mendoza, Argentina, 5500',
    );
  });
});
