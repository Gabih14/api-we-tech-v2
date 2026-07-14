import { Column, Entity, Index } from 'typeorm';

/**
 * Link real entre un ítem y cada valor de atributo que tiene asociado.
 * `arbol` es el id del ítem dueño del árbol de atributos, `atributo` el id del
 * valor en {@link StkAtributo}. `camino` / `atributo_padre` describen la posición
 * dentro del árbol y forman parte de la PK compuesta (arbol + camino).
 */
@Index('atributo', ['atributo'], {})
@Index('atributo_padre', ['atributoPadre'], {})
@Entity('stk_atributo_nodo')
export class StkAtributoNodo {
  @Column('varchar', { primary: true, name: 'arbol', length: 20 })
  arbol: string;

  @Column('varchar', { primary: true, name: 'camino', length: 64 })
  camino: string;

  @Column('varchar', { name: 'atributo', nullable: true, length: 4 })
  atributo: string | null;

  @Column('varchar', { name: 'atributo_padre', nullable: true, length: 4 })
  atributoPadre: string | null;
}
