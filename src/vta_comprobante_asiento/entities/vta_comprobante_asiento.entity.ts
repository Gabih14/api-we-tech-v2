// src/vta-comprobante-asiento/entities/vta-comprobante-asiento.entity.ts
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VtaComprobante } from 'src/vta-comprobante/entities/vta-comprobante.entity';
import { CntAsiento } from 'src/cnt-asiento/entities/cnt-asiento.entity';

@Entity({ name: 'vta_comprobante_asiento' })
export class VtaComprobanteAsiento {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  tipo: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  comprobante: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  ejercicio: string;

  @PrimaryColumn({ type: 'int' })
  asiento: number;

  @ManyToOne(() => VtaComprobante, (c) => c.asientosLink, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'tipo', referencedColumnName: 'tipo' },
    { name: 'comprobante', referencedColumnName: 'comprobante' },
  ])
  comprobanteRef: VtaComprobante;

  // ✅ acá está el fix
  @ManyToOne(() => CntAsiento, (a) => a.vtaLinks, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'ejercicio', referencedColumnName: 'ejercicio' },
    { name: 'asiento', referencedColumnName: 'id' },
  ])
  asientoRef: CntAsiento;
}
