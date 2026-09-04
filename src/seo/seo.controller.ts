import { Controller, Get, Param } from '@nestjs/common';
import { AuthType } from '../common/decorators/auth-type.decorator';
import { SeoProductDto } from './seo-product.dto';
import { SeoService } from './seo.service';

@Controller('seo/products')
@AuthType('public')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get()
  getProducts(): Promise<SeoProductDto[]> {
    return this.seoService.getProducts();
  }

  @Get(':slug')
  getProductBySlug(@Param('slug') slug: string): Promise<SeoProductDto> {
    return this.seoService.getProductBySlug(slug);
  }
}
