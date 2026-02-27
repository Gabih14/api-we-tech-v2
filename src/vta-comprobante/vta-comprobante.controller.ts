import { Controller, Get, Param, Query } from '@nestjs/common';
import { VtaComprobanteService } from './vta-comprobante.service';

@Controller('vta-comprobante')
export class VtaComprobanteController {
  constructor(private readonly vtaComprobanteService: VtaComprobanteService) {}

  // 📊 Resumen para dashboard
  @Get('metrics/resumen')
  getResumen(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vtaComprobanteService.getResumenMetricas(from, to);
  }

  // 📈 Ventas agrupadas por mes
  @Get('metrics/ventas-mensuales')
  getVentasMensuales(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vtaComprobanteService.getVentasMensuales(from, to);
  }

  // 👤 Ventas agrupadas por vendedor
  @Get('metrics/ventas-por-vendedor')
  getVentasPorVendedor(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vtaComprobanteService.getVentasPorVendedor(from, to);
  }

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
