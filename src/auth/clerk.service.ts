import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';

@Injectable()
export class ClerkService {
  readonly client: ClerkClient;
  readonly authorizedParties: string[];

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const publishableKey = this.config.getOrThrow<string>(
      'CLERK_PUBLISHABLE_KEY',
    );
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    this.client = createClerkClient({ secretKey, publishableKey });
    this.authorizedParties = this.parseOrigins([
      frontendUrl,
      this.config.get<string>('ALLOWED_ORIGINS'),
    ]);
  }

  get publishableKey(): string {
    return this.config.getOrThrow<string>('CLERK_PUBLISHABLE_KEY');
  }

  private parseOrigins(values: Array<string | undefined>): string[] {
    return Array.from(
      new Set(
        values
          .flatMap((value) => value?.split(',') ?? [])
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    );
  }
}
