import { Controller, Get, Param, Query } from '@nestjs/common';
import { VtaComprobanteService } from './vta-comprobante.service';
import { AuthType } from '../common/decorators/auth-type.decorator';

@Controller('vta-comprobante')
export class VtaComprobanteController {
  constructor(private readonly vtaComprobanteService: VtaComprobanteService) {}

  // 📊 Resumen para dashboard
  @Get('metrics/resumen')
  @AuthType('read')
  getResumen(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vtaComprobanteService.getResumenMetricas(from, to);
  }

  // 📈 Ventas agrupadas por mes
  @Get('metrics/ventas-mensuales')
  @AuthType('read')
  getVentasMensuales(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vtaComprobanteService.getVentasMensuales(from, to);
  }

  // 👤 Ventas agrupadas por vendedor
  @Get('metrics/ventas-por-vendedor')
  @AuthType('read')
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
