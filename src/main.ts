import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://shop.wetech.ar'];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Permitir cookies y autenticación
  });
  await app.listen(process.env.PORT ?? 3000);
  console.log('CORS configurado con los siguientes orígenes permitidos:', allowedOrigins);
  console.log(`Servidor corriendo en ${process.env.PORT ?? 3000}`);
}
bootstrap();
