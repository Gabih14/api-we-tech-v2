import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body } = req;
    const now = Date.now();

    // Evita loguear bodies grandes o binarios
    const bodyPreview =
      JSON.stringify(body).length > 1000
        ? '[omitted large body]'
        : body;

    console.log(`➡️ ${method} ${url} | Body:`, bodyPreview);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - now;

        // Evita serialización costosa
        const isLarge =
          Array.isArray(data) ? data.length > 50 : false;

        if (isLarge) {
          console.log(
            `⬅️ ${method} ${url} | ⏱ ${duration}ms | Response: [omitted large array ${data.length}]`,
          );
        } else {
          console.log(`⬅️ ${method} ${url} | ⏱ ${duration}ms`);
        }
      }),
      catchError((err) => {
        console.error(
          `❌ ${method} ${url} | ⏱ ${Date.now() - now}ms | Error: ${err.message}`,
        );
        throw err;
      }),
    );
  }
}
