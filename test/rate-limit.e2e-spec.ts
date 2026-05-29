import {
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ApiTokenGuard } from '../src/common/guards/api-token.guard';
import { AuthType } from '../src/common/decorators/auth-type.decorator';

@Controller('rate-limit-test')
class RateLimitTestController {
  @Post('ok')
  @AuthType('public')
  @HttpCode(HttpStatus.OK)
  ok() {
    return { ok: true };
  }

  @Post('limited')
  @AuthType('public')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  limited() {
    return { ok: true };
  }
}

describe('Rate limit (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 100,
          },
        ]),
      ],
      controllers: [RateLimitTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector, configService: ConfigService) =>
            new ApiTokenGuard(reflector, configService),
          inject: [Reflector, ConfigService],
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows requests within the configured limit', async () => {
    await request(app.getHttpServer()).post('/rate-limit-test/ok').expect(200);
  });

  it('returns 429 when a route limit is exceeded', async () => {
    const server = app.getHttpServer();

    await request(server).post('/rate-limit-test/limited').expect(200);
    await request(server).post('/rate-limit-test/limited').expect(200);
    await request(server).post('/rate-limit-test/limited').expect(429);
  });

  it('keeps public webhook-style routes accessible without Authorization', async () => {
    await request(app.getHttpServer()).post('/rate-limit-test/ok').expect(200);
  });
});
