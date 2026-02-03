import { IsEnum, IsOptional, IsString, Length } from "class-validator";

export class CobrarFacturaDto {
  @IsEnum(["CAJA","CUENTA","TARJETA","CHEQUE","CHEQUE_3RO","CERTIFICADO","CTACTE"])
  modalidad:
    | "CAJA"
    | "CUENTA"
    | "TARJETA"
    | "CHEQUE"
    | "CHEQUE_3RO"
    | "CERTIFICADO"
    | "CTACTE";

  // IDs reales que viste en la DB: "BANCO NACION", "EFECTIVO", etc.
  @IsString()
  @Length(1, 20)
  medioId: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  trabajador?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  user?: string;

  // por si algún día necesitás otro punto de venta
  @IsOptional()
  @IsString()
  @Length(5, 5)
  puntoVenta?: string; // "00001"
}
