// src/common/decorators/auth-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const AUTH_TYPE_KEY = 'authType';
export type AuthType = 'default' | 'nave' | 'public';

export const AuthType = (type: AuthType) => SetMetadata(AUTH_TYPE_KEY, type);
