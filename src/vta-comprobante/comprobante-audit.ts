import { Repository } from 'typeorm';
import { PedidoWebAccionLog } from './entities/pedido-web-accion-log.entity';

export type AccionComprobante =
  | 'ALTA_COMPROBANTE'
  | 'MODIFICACION_COMPROBANTE'
  | 'BORRADO_COMPROBANTE';

type LogRepository = Pick<Repository<PedidoWebAccionLog>, 'create' | 'save'>;

export async function registrarAccionComprobante(
  repository: LogRepository,
  accion: AccionComprobante,
  tipo: string,
  comprobante: string,
  detalle: Record<string, unknown>,
): Promise<void> {
  const log = repository.create({
    sede_id: 1,
    accion,
    usuario: 'WEB',
    rol: 'SISTEMA',
    origen: 'remoto',
    referencia: `${tipo} ${comprobante}`.slice(0, 100),
    detalle: JSON.stringify(detalle),
  });

  await repository.save(log);
}
