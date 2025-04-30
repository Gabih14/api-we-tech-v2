import { PartialType } from '@nestjs/mapped-types';
import { CreateSysImageDto } from './create-sys_image.dto';

export class UpdateSysImageDto extends PartialType(CreateSysImageDto) {}
