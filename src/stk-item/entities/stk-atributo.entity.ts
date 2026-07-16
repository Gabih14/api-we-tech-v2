import { Column, Entity, Index } from 'typeorm';

/**
 * Diccionario cerrado y reutilizable de valores de atributos de Nacional Gestión.
 * Cada fila es un valor (ej. Marca=Elegoo, Color=Negro): `clase` es la categoría,
 * `nombre` el texto a mostrar. `color` guarda un color asociado (usado por la clase
 * "Colores") y `orden` define el orden de presentación.
 */
@Index('clase', ['clase'], {})
@Entity('stk_atributo')
export class StkAtributo {
  @Column('varchar', { primary: true, name: 'id', length: 4 })
  id: string;

  @Column('varchar', { name: 'nombre', nullable: true, length: 30 })
  nombre: string | null;

  @Column('varchar', { name: 'clase', nullable: true, length: 20 })
  clase: string | null;

  @Column('varchar', { name: 'color', nullable: true, length: 11 })
  color: string | null;

  @Column('int', { name: 'orden', nullable: true })
  orden: number | null;
}
