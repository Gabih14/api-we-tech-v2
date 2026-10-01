import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SolicitarMayoristaDto {
  @Transform(trim)
  @Matches(/^\d{11}$/, { message: 'cuit debe contener 11 digitos' })
  cuit: string;

  @Transform(trim)
  @IsString()
  @Length(2, 100)
  razonSocial: string;

  @Transform(trim)
  @IsString()
  @Length(6, 30)
  telefono: string;
}
