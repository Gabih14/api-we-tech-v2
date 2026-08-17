import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class CreateClienteDireccionLinkDto {
  @IsString()
  @IsUrl({ require_tld: false })
  @Length(1, 1024)
  link: string;

  @IsOptional()
  @IsString()
  @Length(0, 512)
  direccionTexto?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  etiqueta?: string;

}
