import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('vta_cliente', { schema: 'wetech' })
export class VtaCliente {
  @PrimaryColumn('varchar', { length: 20 })
  id: string;

  @Column('varchar', { name: 'razon_social', nullable: true, length: 100 })
  razonSocial: string | null;

  @Column('varchar', { name: 'nombre_comercial', nullable: true, length: 100 })
  nombreComercial: string | null;

  @Column('varchar', { name: 'tipo_documento', nullable: true, length: 5 })
  tipoDocumento: string | null;

  @Column('varchar', { name: 'numero_documento', nullable: true, length: 15 })
  numeroDocumento: string | null;

  @Column('varchar', { name: 'email', nullable: true, length: 256 })
  email: string | null;

  @Column('varchar', { name: 'telefono', nullable: true, length: 100 })
  telefono: string | null;

  @Column('varchar', { name: 'direccion', nullable: true, length: 100 })
  direccion: string | null;

  @Column('varchar', { name: 'localidad', nullable: true, length: 40 })
  localidad: string | null;

  @Column('varchar', { name: 'provincia', nullable: true, length: 20 })
  provincia: string | null;

  @Column('varchar', { name: 'pais', nullable: true, length: 20 })
  pais: string | null;

  // ⚠️ En la base es varchar(10). Estaba declarado 20 y por eso un CPA con la
  // localidad pegada ("M5539 Las Heras") pasaba la validación y MySQL lo
  // truncaba en silencio a "M5539 Las ".
  @Column('varchar', { name: 'cpa', nullable: true, length: 10 })
  cpa: string | null;

  @Column('varchar', { name: 'empresa', nullable: true, length: 30 })
  empresa: string | null;

  @Column('varchar', { name: 'condicion_iva', nullable: true, length: 5 })
  condicionIva: string | null;

  @Column('varchar', { name: 'lista', nullable: true, length: 20 })
  lista: string | null;

  @Column('varchar', { name: 'rubro', nullable: true, length: 30 })
  rubro: string | null;

  // La API conserva `observaciones`, pero el esquema actual del ERP la guarda
  // en la columna `notas`.
  @Column('text', { name: 'notas', nullable: true })
  observaciones: string | null;

  @Column('tinyint', { name: 'visible', nullable: true, default: 1 })
  visible: boolean | null;

  @Column('varchar', { name: 'contacto', nullable: true, length: 512 })
  contacto: string | null;
}
