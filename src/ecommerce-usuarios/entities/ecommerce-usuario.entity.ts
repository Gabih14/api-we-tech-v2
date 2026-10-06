import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoMayorista {
  NO_SOLICITADO = 'NO_SOLICITADO',
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum FiguraFiscalComercial {
  EMPRENDEDOR_CONSUMIDOR_FINAL = 'EMPRENDEDOR_CONSUMIDOR_FINAL',
  EMPRENDEDOR_MONOTRIBUTISTA = 'EMPRENDEDOR_MONOTRIBUTISTA',
  RESPONSABLE_INSCRIPTO = 'RESPONSABLE_INSCRIPTO',
  SOCIEDAD_SIMPLE = 'SOCIEDAD_SIMPLE',
  SOCIEDAD_ESTANDAR = 'SOCIEDAD_ESTANDAR',
}

export enum PerfilCompraInicial {
  GRAN_CONSUMIDOR_FINAL_96_239_KG = 'GRAN_CONSUMIDOR_FINAL_96_239_KG',
  PUNTO_VENTA_OFICIAL_240_479_KG = 'PUNTO_VENTA_OFICIAL_240_479_KG',
  PUNTO_VENTA_PLUS_480_KG = 'PUNTO_VENTA_PLUS_480_KG',
  PLUS_960_KG = 'PLUS_960_KG',
  NIVEL_SUPERIOR_2_TN = 'NIVEL_SUPERIOR_2_TN',
  NIVEL_SUPERIOR_4_TN = 'NIVEL_SUPERIOR_4_TN',
}

export enum SedeComercial {
  TALLER_OFICINA = 'TALLER_OFICINA',
  LOCAL_PUBLICO = 'LOCAL_PUBLICO',
}

export enum OfertaPublico {
  FABRICACION_IMPRESORAS_3D_PROPIAS = 'FABRICACION_IMPRESORAS_3D_PROPIAS',
  SERVICIO_IMPRESION_3D = 'SERVICIO_IMPRESION_3D',
  CURSOS_TALLERES = 'CURSOS_TALLERES',
  VENTA_COMPONENTES_REPUESTOS = 'VENTA_COMPONENTES_REPUESTOS',
  SERVICIO_DISENO_3D = 'SERVICIO_DISENO_3D',
  VENTA_IMPRESORAS_3D_IMPORTADAS = 'VENTA_IMPRESORAS_3D_IMPORTADAS',
  VENTA_ACTUAL_FILAMENTOS = 'VENTA_ACTUAL_FILAMENTOS',
}

@Entity('ecommerce_usuario')
export class EcommerceUsuario {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'clerk_user_id', type: 'varchar', length: 255, unique: true })
  clerkUserId: string;

  @Column({ name: 'cliente_id', type: 'varchar', length: 20, nullable: true })
  clienteId: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  cuit: string | null;

  @Column({
    name: 'razon_social',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  razonSocial: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({
    name: 'nombre_comercio',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  nombreComercio: string | null;

  @Column({
    name: 'persona_responsable',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  personaResponsable: string | null;

  @Column({
    name: 'ubicacion_zona',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  ubicacionZona: string | null;

  @Column({
    name: 'figura_fiscal_comercial',
    type: 'enum',
    enum: FiguraFiscalComercial,
    nullable: true,
  })
  figuraFiscalComercial: FiguraFiscalComercial | null;

  @Column({
    name: 'perfil_compra_inicial',
    type: 'enum',
    enum: PerfilCompraInicial,
    nullable: true,
  })
  perfilCompraInicial: PerfilCompraInicial | null;

  @Column({
    name: 'sede_comercial',
    type: 'enum',
    enum: SedeComercial,
    nullable: true,
  })
  sedeComercial: SedeComercial | null;

  @Column({ name: 'ofertas_publico', type: 'json', nullable: true })
  ofertasPublico: OfertaPublico[] | null;

  @Column({
    name: 'marcas_filamento',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  marcasFilamento: string | null;

  @Column({
    name: 'estado_mayorista',
    type: 'enum',
    enum: EstadoMayorista,
    default: EstadoMayorista.NO_SOLICITADO,
  })
  estadoMayorista: EstadoMayorista;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
