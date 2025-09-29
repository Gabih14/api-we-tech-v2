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
                console.log(
                    `⬅️ ${method} ${url} | ⏱ ${Date.now() - now}ms | Response:`,
                    data,
                );
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
