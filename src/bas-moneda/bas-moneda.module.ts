import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BasMoneda } from "./entities/bas-moneda.entity";
import { BasMonedaService } from "./bas-moneda.service";
import { BasMonedaController } from "./bas-moneda.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BasMoneda])],
  controllers: [BasMonedaController],
  providers: [BasMonedaService],
  exports: [BasMonedaService],
})
export class BasMonedaModule {}
