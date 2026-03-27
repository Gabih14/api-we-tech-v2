import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('delivery_config')
export class DeliveryConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, nullable: false })
  telefono: string;

  @Column({ length: 255, nullable: false })
  api_key: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @UpdateDateColumn({ 
    name: 'actualizado_en', 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP' 
  })
  actualizadoEn: Date;
}