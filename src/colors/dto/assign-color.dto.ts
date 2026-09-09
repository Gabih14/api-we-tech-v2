import { IsBoolean, IsOptional } from 'class-validator';

export class AssignColorDto {
  /** Por defecto un producto tiene un solo color; false permite sumar otro nodo. */
  @IsOptional()
  @IsBoolean()
  replaceExisting = true;
}
