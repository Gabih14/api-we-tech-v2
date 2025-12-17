import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const timestamp = new Date().toISOString();
    const path = request?.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: any = {
      code: 'ERR_INTERNAL',
      message: 'Ocurrió un error inesperado. Vuelve más tarde.',
      retryable: false,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        payload.message = res;
      } else if (typeof res === 'object' && res) {
        payload = {
          code: (res as any).code || payload.code,
          message: (res as any).message || payload.message,
          retryable:
            (res as any).retryable !== undefined
              ? (res as any).retryable
              : payload.retryable,
          details: (res as any).details,
        };
      }
    } else {
      // Non-HttpException (unexpected)
      // Do not expose internals; keep a generic message
    }

    response.status(status).json({
      ...payload,
      status,
      timestamp,
      path,
    });
  }
}
