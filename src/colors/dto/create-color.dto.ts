import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateColorDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'id solo puede contener letras, numeros, guion y guion bajo',
  })
  @MaxLength(10)
  id: string;

  @IsString()
  @MaxLength(30)
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'hex debe tener formato #RRGGBB',
  })
  hex: string;

  @IsOptional()
  @IsInt()
  order?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  colorGroupId?: number | null;
}
