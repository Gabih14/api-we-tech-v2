import { Injectable,  } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MapsService {
  private readonly googleApiKey: string;
  private readonly originPlaceId = 'place_id:ChIJaWI2TDwJfpYRx4Y5N9AgsAY';

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not defined in environment variables');
    }
    this.googleApiKey = apiKey;
  }

  async getDistanceToDestination(address: string, city: string) {
  const destination = `${address}, ${city}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${encodeURIComponent(destination)}&origins=${this.originPlaceId}&key=${this.googleApiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== 'OK') {
      throw new Error(data.error_message || 'Error en la respuesta de la API');
    }

    const element = data.rows[0].elements[0];

    return {
      distance: element.distance.text,
      duration: element.duration.text,
      destinationResolved: data.destination_addresses[0],
      originResolved: data.origin_addresses[0],
      raw: element
    };
  } catch (err) {
    return {
      error: 'No se pudo obtener la distancia',
      detail: err.message
    };
  }
}

}
