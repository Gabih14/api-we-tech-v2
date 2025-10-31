import { Controller, Get, Param } from '@nestjs/common';
import { VtaComprobanteService } from './vta-comprobante.service';

@Controller('vta-comprobante')
export class VtaComprobanteController {
  constructor(private readonly vtaComprobanteService: VtaComprobanteService) {}

  // 📋 Listar todos los comprobantes
  @Get()
  findAll() {
    return this.vtaComprobanteService.findAll();
  }

  // 🔍 Buscar un comprobante por tipo y número
  @Get(':tipo/:comprobante')
  findOne(
    @Param('tipo') tipo: string,
    @Param('comprobante') comprobante: string,
  ) {
    return this.vtaComprobanteService.findOne(tipo, comprobante);
  }
}
