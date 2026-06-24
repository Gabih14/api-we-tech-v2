import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiTokenGuard } from './common/guards/api-token.guard';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpErrorFilter } from './common/filters/http-exception.filter';
import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['https://shop.wetech.ar'];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Permitir cookies y autenticación
  });

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());

  // 🔒 Guard global: toda la API protegida por tokens
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);
  app.useGlobalGuards(new ApiTokenGuard(reflector, configService));

  /* BORRAR */
  app.use((req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  /* BORRAR */

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    'CORS configurado con los siguientes orígenes permitidos:',
    allowedOrigins,
  );
  console.log(`Servidor corriendo en ${process.env.PORT ?? 3000}`);
  console.log("Cambios: IVA")
  console.log(`Tiempo de CRON de aprobación de transferencias: ${process.env.PEDIDO_TRANSFER_APPROVAL_CRON ?? 'no configurado'}`);
  console.log(`Tiempo de TTL de transferencias: ${process.env.PEDIDO_TRANSFER_TTL_MIN ?? 'no configurado'}`);
  console.log(`Hora de la actualización: ${new Date().toLocaleString()}`);


}
bootstrap();
