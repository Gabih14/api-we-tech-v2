import { IsString } from 'class-validator';

export class CreateSysImageDto {
  @IsString()
  id: string;

  @IsString()
  description: string; // contendrá la URL de la imagen
}
