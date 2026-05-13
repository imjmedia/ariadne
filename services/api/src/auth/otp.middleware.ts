/**
 * @fileoverview Middleware OTP: valida JWT emitido por verify o Secret MCP (`ari_…`). Protege /api/* excepto health, openapi y auth.
 * Adjunta req.user con { sub, email, userId, role } para uso en controladores y proxy.
 */
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

const SKIP_PATHS = [
  '/api/health',
  '/api/openapi.json',
  '/api/auth/otp/request',
  '/api/auth/otp/verify',
  '/api/auth/sso/login',
  '/api/auth/has-users',
  '/api/auth/register-first-admin',
  '/api/internal/users/validate-mcp-token',
];

/** Interfaz del usuario autenticado extraído del JWT. */
export interface AuthenticatedUser {
  sub: string;
  email?: string;
  userId?: string;
  role?: string;
  name?: string;
}

function getToken(req: Request): string | null {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

/**
 * Middleware: valida JWT OTP o secret MCP (`ari_…`), asigna req.user y llama next().
 * El MCP puede reenviar el mismo Bearer que Cursor envía al endpoint MCP (Perfil → Secret MCP).
 */
export function createOtpAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Preflight CORS: sin Authorization; debe pasar aunque el orden de middlewares cambie.
    if (req.method === 'OPTIONS') return next();

    const path = req.path || req.url?.split('?')[0] || '';
    if (SKIP_PATHS.some((p) => path === p)) return next();

    const token = getToken(req);
    if (!token) {
      res.status(401).json({ statusCode: 401, message: 'Token no proporcionado' });
      return;
    }

    let user = authService.verifyToken(token);

    if (!user && token.startsWith('ari_')) {
      const mcp = await authService.validateMcpToken(token);
      if (mcp.valid && mcp.user) {
        user = {
          sub: mcp.user.email,
          email: mcp.user.email,
          userId: mcp.user.id,
          role: mcp.user.role,
          name: mcp.user.name ?? undefined,
        };
      }
    }

    if (!user) {
      res.status(401).json({ statusCode: 401, message: 'Token inválido o expirado' });
      return;
    }

    (req as Request & { user?: AuthenticatedUser }).user = user;
    next();
  };
}

/**
 * Middleware que verifica que el usuario autenticado tenga rol 'admin'.
 * Usar en rutas que requieran administración.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthenticatedUser }).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ statusCode: 403, message: 'Acceso denegado: se requiere rol admin' });
    return;
  }
  next();
}
