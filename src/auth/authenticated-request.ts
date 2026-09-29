import { Request } from 'express';
import { EcommerceUsuario } from '../ecommerce-usuarios/entities/ecommerce-usuario.entity';

export interface ClerkAuthentication {
  userId: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  clerkAuth?: ClerkAuthentication;
  ecommerceUsuario?: EcommerceUsuario;
}
