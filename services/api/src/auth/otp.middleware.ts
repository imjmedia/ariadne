/**
 * @fileoverview Middleware: valida (1) Secret MCP (`ari_*`) contra Ingest/BD y (2) JWT de sesión web (OTP/SSO). Protege /api/* excepto health, openapi y auth.
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
 * Middleware: valida Secret MCP (`ari_*`) contra Ingest **o** JWT de sesión; asigna req.user y llama next().
 * El Bearer que envía Cursor al MCP (`mcp.json`) es el mismo `ari_*` de Perfil; el servidor MCP lo reenvía al Nest.
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

    let user: AuthenticatedUser | undefined;

    if (token.startsWith('ari_')) {
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
    } else {
      const jwtOutcome = authService.verifySessionJwtOutcome(token);
      if (jwtOutcome.ok) {
        const u = jwtOutcome.user;
        user = {
          sub: u.sub,
          email: u.email,
          userId: u.userId,
          role: u.role,
          name: u.name,
        };
      } else if (jwtOutcome.reason === 'expired') {
        res.status(401).json({
          statusCode: 401,
          message: 'Sesión JWT expirada; inicia sesión de nuevo desde la aplicación web',
          code: 'JWT_EXPIRED',
        });
        return;
      }
    }

    if (!user) {
      res.status(401).json({
        statusCode: 401,
        message: 'Token inválido, revocado o Secret MCP no reconocido',
      });
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
