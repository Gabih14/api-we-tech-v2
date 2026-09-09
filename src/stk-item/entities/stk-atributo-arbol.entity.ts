import { Column, Entity } from 'typeorm';

@Entity('stk_atributo_arbol')
export class StkAtributoArbol {
  @Column('varchar', { primary: true, name: 'id', length: 20 })
  id: string;

  @Column('varchar', { name: 'nombre', nullable: true, length: 50 })
  nombre: string | null;

  @Column('char', { name: 'splitc', nullable: true, length: 1 })
  splitc: string | null;

  @Column('char', { name: 'splitv', nullable: true, length: 1 })
  splitv: string | null;

  @Column('varchar', { name: 'color', nullable: true, length: 11 })
  color: string | null;

  @Column('int', { name: 'orden', nullable: true })
  orden: number | null;

  @Column('bit', { name: 'visible', nullable: true, default: () => "b'1'" })
  visible: boolean | Buffer | null;
}
