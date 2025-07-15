import { Column, Entity } from "typeorm";

@Entity("sys_image")
export class SysImage {
  @Column("varchar", { primary: true, name: "id", length: 20 })
  id: string;

  @Column("varchar", { name: "description", nullable: true, length: 100 })
  description: string | null;

  /* @Column("longblob", { name: "image" })
  image: Buffer | null; // Cambiado a Buffer para almacenar imágenes en formato binario */
}
