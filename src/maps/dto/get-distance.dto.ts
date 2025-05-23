import { IsString } from 'class-validator';

export class GetDistanceDto {
  @IsString()
  address: string;

  @IsString()
  city: string;
}
