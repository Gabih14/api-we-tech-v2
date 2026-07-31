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
    const requestUrl = req.originalUrl ?? url;
    if (this.shouldIgnoreRequestLog(method, requestUrl)) {
      return next.handle();
    }

    const now = Date.now();
    const shouldAlwaysLogBody =
      method === 'POST' && this.isPedidoCreateRequest(requestUrl);

    // Evita loguear bodies grandes o no serializables
    let bodyPreview: any = body;
    try {
      const serialized = JSON.stringify(body);
      if (serialized && serialized.length > 1000 && !shouldAlwaysLogBody) {
        bodyPreview = '[omitted large body]';
      } else {
        bodyPreview = body;
      }
    } catch {
      bodyPreview = '[unserializable body]';
    }

    if (bodyPreview === undefined) {
      console.log(`➡️ ${method} ${url}`);
    } else {
      console.log(`➡️ ${method} ${url} | Body:`, bodyPreview);
    }

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

  private isPedidoCreateRequest(url: string): boolean {
    const path = url.split('?')[0].replace(/\/+$/, '');
    return path === '/pedido' || path.endsWith('/pedido');
  }

  private shouldIgnoreRequestLog(method: string, url: string): boolean {
    const path = url.split('?')[0].replace(/\/+$/, '');
    return method === 'GET' && path.endsWith('/vta-comprobante/metrics');
  }
}
