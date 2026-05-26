import { Matches, IsString } from 'class-validator';

export class CreateColorDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'hex debe tener formato #RRGGBB',
  })
  hex: string;
}
