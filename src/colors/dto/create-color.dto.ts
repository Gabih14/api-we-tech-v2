import {
  IsInt,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ArrayMinSize,
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

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'hex debe tener formato #RRGGBB',
  })
  hex?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    each: true,
    message: 'cada hex debe tener formato #RRGGBB',
  })
  hexes?: string[];

  @IsOptional()
  @IsInt()
  order?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  colorGroupId?: number | null;
}
