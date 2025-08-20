import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiTokenGuard } from './common/guards/api-token.guard';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'https://shop.wetech.ar'],
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Permitir cookies y autenticación
  });

  // 🔒 Guard global: toda la API protegida por tokens
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);
  app.useGlobalGuards(new ApiTokenGuard(reflector, configService));

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
