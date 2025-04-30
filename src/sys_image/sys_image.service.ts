import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult, DeleteResult } from 'typeorm';
import { SysImage } from './entities/sys_image.entity';
import { CreateSysImageDto } from './dto/create-sys_image.dto';

@Injectable()
export class SysImageService {
  constructor(
    @InjectRepository(SysImage)
    private readonly sysImageRepository: Repository<SysImage>,
  ) {}

  async create(dto: CreateSysImageDto): Promise<SysImage> {
    const nuevaImagen = this.sysImageRepository.create({
      ...dto,
     /*  image: null */
      // image property is not used
    });

    return await this.sysImageRepository.save(nuevaImagen);
  }

  async update(id: string, dto: CreateSysImageDto): Promise<UpdateResult> {
    return await this.sysImageRepository.update(id, {
      ...dto,
     /*  image: null */ // seguimos ignorando el campo imagen
    });
  }

  async remove(id: string): Promise<DeleteResult> {
    return await this.sysImageRepository.delete(id);
  }

  async findAll(): Promise<SysImage[]> {
    return await this.sysImageRepository.find();
  }

  async findOne(id: string): Promise<SysImage | null> {
    return await this.sysImageRepository.findOneBy({ id });
  }
}
