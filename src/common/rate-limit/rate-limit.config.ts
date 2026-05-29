import { ExecutionContext } from '@nestjs/common';

export const RATE_LIMIT_TTL_MS = 'RATE_LIMIT_TTL_MS';
export const RATE_LIMIT_GLOBAL = 'RATE_LIMIT_GLOBAL';
export const RATE_LIMIT_PEDIDO_CREATE = 'RATE_LIMIT_PEDIDO_CREATE';
export const RATE_LIMIT_NAVE_WEBHOOK = 'RATE_LIMIT_NAVE_WEBHOOK';
export const RATE_LIMIT_MAPS_DISTANCE = 'RATE_LIMIT_MAPS_DISTANCE';

export const DEFAULT_RATE_LIMIT_TTL_MS = 60000;
export const DEFAULT_RATE_LIMIT_GLOBAL = 300;
export const DEFAULT_RATE_LIMIT_PEDIDO_CREATE = 30;
export const DEFAULT_RATE_LIMIT_NAVE_WEBHOOK = 120;
export const DEFAULT_RATE_LIMIT_NAVE_WEBHOOK_TEST = 60;
export const DEFAULT_RATE_LIMIT_MAPS_DISTANCE = 60;

export function getRateLimitValue(
  name: string,
  defaultValue: number,
): number {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }

  return value;
}

export function rateLimitValue(
  name: string,
  defaultValue: number,
): (_context: ExecutionContext) => number {
  return () => getRateLimitValue(name, defaultValue);
}
