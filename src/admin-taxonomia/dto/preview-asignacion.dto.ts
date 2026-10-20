import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SetArbolAtributoDto } from './set-arbol-atributo.dto';

export class PreviewAsignacionDto extends SetArbolAtributoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  clase: string;
}
