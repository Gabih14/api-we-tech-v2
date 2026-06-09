import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type GoogleAddressComponent = {
  types?: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  types?: string[];
  address_components?: GoogleAddressComponent[];
};

type DestinationContext = {
  province?: string;
  country?: string;
  postalCode?: string;
};

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

  async getDistanceToDestination(
    address: string,
    city: string,
    context: DestinationContext = {},
  ) {
    const destination = this.formatDestination(address, city, context);

    try {
      const geocodeResult = await this.geocodeDestination(destination);

      if (!this.isSpecificStreetAddress(geocodeResult)) {
        return {
          error: 'La dirección es demasiado imprecisa',
          detail:
            'No se pudo identificar calle y altura. Revisá la dirección antes de calcular el envío.',
          needsMoreSpecificAddress: true,
          destinationResolved: geocodeResult?.formatted_address ?? null,
        };
      }

      const specificGeocodeResult = geocodeResult as GoogleGeocodeResult & {
        place_id: string;
      };
      const destinationParam = `place_id:${specificGeocodeResult.place_id}`;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${encodeURIComponent(destinationParam)}&origins=${this.originPlaceId}&key=${this.googleApiKey}`;

      const response = await axios.get(url);
      const data = response.data;

      if (data.status !== 'OK') {
        throw new Error(data.error_message || 'Error en la respuesta de la API');
      }

      const element = data.rows?.[0]?.elements?.[0];

      if (!element || element.status !== 'OK') {
        throw new Error(element?.status || 'Destino no alcanzable');
      }

      return {
        distance: element.distance.text,
        duration: element.duration.text,
        destinationResolved:
          specificGeocodeResult.formatted_address ||
          data.destination_addresses?.[0],
        originResolved: data.origin_addresses?.[0],
        raw: element,
      };
    } catch (err) {
      return {
        error: 'No se pudo obtener la distancia',
        detail: err.message,
      };
    }
  }

  private async geocodeDestination(
    destination: string,
  ): Promise<GoogleGeocodeResult | null> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${this.googleApiKey}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== 'OK') {
      throw new Error(data.error_message || 'Error al validar la dirección');
    }

    return data.results?.[0] ?? null;
  }

  private formatDestination(
    address: string,
    city: string,
    context: DestinationContext,
  ): string {
    return [
      address,
      city,
      context.province,
      context.country,
      context.postalCode,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
  }

  private isSpecificStreetAddress(result: GoogleGeocodeResult | null): boolean {
    if (!result?.place_id) {
      return false;
    }

    const components = result.address_components ?? [];
    const hasStreetNumber = components.some((component) =>
      component.types?.includes('street_number'),
    );
    const hasRoute = components.some((component) =>
      component.types?.includes('route'),
    );

    return hasStreetNumber && hasRoute;
  }
}
