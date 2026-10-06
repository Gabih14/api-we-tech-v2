import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import {
  FiguraFiscalComercial,
  OfertaPublico,
  PerfilCompraInicial,
  SedeComercial,
} from '../entities/ecommerce-usuario.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class SolicitarMayoristaDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  nombreComercio: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120)
  personaResponsable: string;

  @Transform(trim)
  @IsString()
  @Length(2, 150)
  ubicacionZona: string;

  @Transform(trim)
  @IsString()
  @Length(6, 30)
  telefono: string;

  @IsEnum(FiguraFiscalComercial)
  figuraFiscalComercial: FiguraFiscalComercial;

  @IsEnum(PerfilCompraInicial)
  perfilCompraInicial: PerfilCompraInicial;

  @IsEnum(SedeComercial)
  sedeComercial: SedeComercial;

  @Transform(trimArray)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(OfertaPublico, { each: true })
  ofertasPublico: OfertaPublico[];

  @ValidateIf((dto: SolicitarMayoristaDto) =>
    dto.ofertasPublico?.includes(OfertaPublico.VENTA_ACTUAL_FILAMENTOS),
  )
  @Transform(trim)
  @IsString()
  @Length(2, 500)
  marcasFilamento?: string;
}
