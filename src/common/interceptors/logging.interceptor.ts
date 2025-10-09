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
        const method = req.method;
        const url = req.url;
        const body = req.body;

        const now = Date.now();

        console.log(`➡️ ${method} ${url} | Body:`, body);

        return next.handle().pipe(
            tap((data) => {
                const duration = Date.now() - now;

                // No imprimir respuestas muy grandes o específicas como GET /stk-item
                const isStkItemList = method === 'GET' && /^\/stk-item\/?(\?.*)?$/.test(url);

                // Intentar calcular tamaño de la respuesta
                let size = 0;
                try {
                    size = JSON.stringify(data)?.length ?? 0;
                } catch {
                    // ignore
                }

                if (isStkItemList) {
                    const summary = Array.isArray(data)
                        ? `Array(${data.length})`
                        : typeof data;
                    console.log(`⬅️ ${method} ${url} | ⏱ ${duration}ms | Response: [omitted] ${summary}`);
                    return;
                }

                // Umbral genérico para omitir payloads muy grandes
                const LARGE_THRESHOLD = 2000; // chars
                if (size > LARGE_THRESHOLD || (Array.isArray(data) && data.length > 50)) {
                    console.log(`⬅️ ${method} ${url} | ⏱ ${duration}ms | Response: [omitted ${size} chars]`);
                } else {
                    console.log(`⬅️ ${method} ${url} | ⏱ ${duration}ms | Response:`, data);
                }
            }),
            catchError((err) => {
                console.error(
                    `❌ ${method} ${url} | ⏱ ${Date.now() - now}ms | Error:`,
                    err.message,
                );
                throw err;
            }),
        );
    }
}
