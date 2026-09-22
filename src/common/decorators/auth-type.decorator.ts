// src/common/decorators/auth-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const AUTH_TYPE_KEY = 'authType';
export type AuthType =
  | 'default'
  | 'nave'
  | 'public'
  | 'dashboard'
  | 'read'
  | 'write';

export type AuthTypeRequirement = AuthType | AuthType[];

export const AuthType = (...types: AuthType[]) =>
  SetMetadata(AUTH_TYPE_KEY, types.length === 1 ? types[0] : types);
