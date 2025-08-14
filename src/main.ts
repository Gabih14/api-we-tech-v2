import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:5173', 'https://shop.wetech.ar'],
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Permitir cookies y autenticación
  });
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
