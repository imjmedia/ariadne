/**
 * @fileoverview Servicio OTP: genera código, envía por email (SMTP), emite JWT con rol.
 * Tras verify OTP, resuelve usuario en Ingest para incluir userId y role en JWT.
 */
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { EmailService } from './email.service';
import { getSystemSettingsRuntime } from '../system-settings/system-settings.client';

/** Result of verifying an OTP/session JWT issued by verifyOtp / ssoLogin. */
export type SessionJwtOutcome =
  | {
      ok: true;
      user: { sub: string; email?: string; userId?: string; role?: string; name?: string };
    }
  | { ok: false; reason: 'expired' | 'invalid' };

const OTP_TTL_SEC = 300; // 5 min
const OTP_LENGTH = 6;
const JWT_SECRET = process.env.JWT_SECRET || 'ariadne-dev-secret-change-in-prod';
// 7 días en segundos (JWT_EXPIRES: segundos, ej. 604800)
const JWT_EXPIRES_SEC = parseInt(process.env.JWT_EXPIRES ?? '604800', 10) || 604800;

/** URL del servicio Ingest para resolver usuarios. */
const INGEST_URL = process.env.INGEST_URL || 'http://localhost:3002';

/** Store en memoria. key = email, value = { code, expiresAt } */
const memoryStore = new Map<string, { code: string; expiresAt: number }>();

/** true / 1 / yes (trim, sin sensibilidad a mayúsculas). Tolera CRLF en .env. */
function isOtpDevMode(): boolean {
  const v = (process.env.OTP_DEV_MODE ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export interface OtpRequestResult {
  sent: boolean;
  /** Solo en OTP_DEV_MODE: código para testing (cuando SMTP falla o no está configurado) */
  devCode?: string;
}

export interface VerifyResult {
  valid: boolean;
  token?: string;
  /** Datos del usuario autenticado */
  user?: { id: string; email: string; role: string; name: string | null };
}

@Injectable()
export class AuthService {
  constructor(private readonly emailService: EmailService) {}

  /** Genera OTP, lo envía por email (SMTP) y lo almacena. */
  async requestOtp(email: string): Promise<OtpRequestResult> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Email requerido');
    }

    const cfg = await getSystemSettingsRuntime();
    const emailOtpWhitelist = cfg.emailOtp?.trim().toLowerCase() || null;
    if (emailOtpWhitelist && normalized !== emailOtpWhitelist) {
      throw new BadRequestException('Email no autorizado para solicitar OTP');
    }

    const code = Array.from({ length: OTP_LENGTH }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
    const expiresAt = Date.now() + OTP_TTL_SEC * 1000;

    memoryStore.set(normalized, { code, expiresAt });

    const devMode = isOtpDevMode();
    const emailSent = await this.emailService.sendOtp(normalized, code);

    if (!emailSent && !devMode) {
      throw new ServiceUnavailableException(
        'No se pudo enviar el email (SMTP no configurado o error de envío). ' +
          'Configura SMTP en Ajustes → Sistema, o define OTP_DEV_MODE=true para desarrollo (código en devCode).',
      );
    }

    return {
      sent: true,
      ...(devMode && { devCode: code }),
    };
  }

  /** Valida OTP y devuelve JWT con userId + role si es correcto. */
  async verifyOtp(email: string, code: string): Promise<VerifyResult> {
    const normalized = email.trim().toLowerCase();
    const stored = memoryStore.get(normalized);
    if (!stored) {
      return { valid: false };
    }
    if (Date.now() > stored.expiresAt) {
      memoryStore.delete(normalized);
      return { valid: false };
    }
    if (stored.code !== code.trim()) {
      return { valid: false };
    }

    memoryStore.delete(normalized);

    // Resolver usuario en Ingest (find-or-create)
    let userId: string | undefined;
    let role = 'admin'; // fallback admin para backward compat
    let userName: string | null = null;

    try {
      const ingestRes = await fetch(`${INGEST_URL}/internal/users/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, createIfMissing: true }),
      });
      if (ingestRes.ok) {
        const ingestUser = await ingestRes.json() as {
          id: string;
          email: string;
          role: string;
          name: string | null;
        };
        userId = ingestUser.id;
        role = ingestUser.role ?? 'developer';
        userName = ingestUser.name ?? null;
      }
    } catch {
      // Si Ingest no está disponible, usar defaults (admin, sin userId)
      console.warn('[auth] No se pudo resolver usuario en Ingest, usando defaults');
    }

    const payload: Record<string, unknown> = { sub: normalized, email: normalized };
    if (userId) payload.userId = userId;
    payload.role = role;
    if (userName) payload.name = userName;

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_SEC });

    return {
      valid: true,
      token,
      user: { id: userId ?? normalized, email: normalized, role, name: userName },
    };
  }

  /** Verifica JWT de sesión (web/localStorage): distingue caducidad vs formato inválido. */
  verifySessionJwtOutcome(token: string): SessionJwtOutcome {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        sub?: string;
        email?: string;
        userId?: string;
        role?: string;
        name?: string;
      };
      if (decoded?.sub) {
        return {
          ok: true,
          user: {
            sub: decoded.sub,
            email: decoded.email,
            userId: decoded.userId,
            role: decoded.role,
            name: decoded.name,
          },
        };
      }
      return { ok: false, reason: 'invalid' };
    } catch (e: unknown) {
      const isExpired =
        typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        (e as { name: string }).name === 'TokenExpiredError';
      if (isExpired) {
        return { ok: false, reason: 'expired' };
      }
      return { ok: false, reason: 'invalid' };
    }
  }

  /** Verifica JWT y devuelve payload o null (compat callers). */
  verifyToken(token: string): { sub: string; email?: string; userId?: string; role?: string; name?: string } | null {
    const r = this.verifySessionJwtOutcome(token);
    return r.ok ? r.user : null;
  }

  /** Valida un token MCP contra el servicio Ingest. */
  async validateMcpToken(token: string): Promise<{ valid: boolean; user?: { id: string; email: string; role: string; name: string | null } }> {
    if (!token?.trim()) return { valid: false };
    try {
      const res = await fetch(`${INGEST_URL}/internal/users/validate-mcp-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (res.ok) {
        return res.json() as Promise<{ valid: boolean; user?: { id: string; email: string; role: string; name: string | null } }>;
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Login via SSO externo.
   * Valida el token contra SSO_URL/verify, crea/actualiza usuario local y emite JWT.
   */
  async ssoLogin(
    ssoToken: string,
    ssoUrl: string,
  ): Promise<{
    valid: boolean;
    token?: string;
    user?: { id: string; email: string; role: string; name: string | null };
    ssoUrl?: string;
  }> {
    try {
      // Validar token contra el SSO
      const verifyUrl = `${ssoUrl.replace(/\/$/, '')}/verify`;
      const ssoRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ssoToken }),
      });

      if (!ssoRes.ok) {
        return { valid: false };
      }

      const ssoData = (await ssoRes.json()) as {
        email?: string;
        role?: string;
        name?: string;
      };

      if (!ssoData?.email) {
        return { valid: false };
      }

      const email = ssoData.email.trim().toLowerCase();
      const role = ssoData.role === 'admin' ? 'admin' : 'developer';
      const name = ssoData.name?.trim() || null;

      // Resolver o crear usuario local
      let userId: string;
      let localRole = role;
      try {
        const ingestRes = await fetch(`${INGEST_URL}/internal/users/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, createIfMissing: true }),
        });
        if (ingestRes.ok) {
          const ingestUser = (await ingestRes.json()) as {
            id: string;
            email: string;
            role: string;
            name: string | null;
          };
          userId = ingestUser.id;
          // Actualizar rol si el SSO lo provee (solo si es diferente)
          if (role !== ingestUser.role) {
            try {
              await fetch(`${INGEST_URL}/internal/users/update-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ingestUser.id, role }),
              });
            } catch {
              // Ignorar error de actualización de rol
            }
          }
          localRole = role;
        } else {
          return { valid: false };
        }
      } catch {
        return { valid: false };
      }

      // Emitir JWT local
      const payload: Record<string, unknown> = { sub: email, email };
      payload.userId = userId;
      payload.role = localRole;
      if (name) payload.name = name;

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_SEC });

      return {
        valid: true,
        token,
        user: { id: userId, email, role: localRole, name },
        ssoUrl,
      };
    } catch {
      return { valid: false };
    }
  }

  /** GET /auth/has-users — consulta a Ingest si hay usuarios registrados. */
  async hasUsers(): Promise<{ hasUsers: boolean }> {
    try {
      const res = await fetch(`${INGEST_URL}/internal/users/count`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json() as { count: number };
        return { hasUsers: data.count > 0 };
      }
    } catch {
      // Si Ingest no está disponible, asumir que hay usuarios para no bloquear login
    }
    return { hasUsers: true };
  }

  /** POST /auth/register-first-admin — crea el primer admin en Ingest. */
  async registerFirstAdmin(
    email: string,
    name?: string,
    password?: string,
  ): Promise<{ created: boolean; message: string; user?: { id: string; email: string; role: string; name: string | null } }> {
    const normalized = email.trim().toLowerCase();
    try {
      const res = await fetch(`${INGEST_URL}/internal/users/register-first-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          name: name?.trim() || null,
          password: password?.trim() || null,
        }),
      });
      if (res.ok) {
        const user = await res.json() as { id: string; email: string; role: string; name: string | null };
        return { created: true, message: 'Administrador creado exitosamente', user };
      }
      const err = await res.json().catch(() => ({})) as { message?: string };
      return { created: false, message: err.message ?? 'Error al crear administrador' };
    } catch {
      return { created: false, message: 'No se pudo conectar con el servicio de usuarios' };
    }
  }

  /**
   * POST /auth/login — login básico email+password.
   * Emite el mismo JWT de sesión que OTP/SSO.
   */
  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<VerifyResult> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      return { valid: false };
    }
    try {
      const res = await fetch(`${INGEST_URL}/internal/users/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, password }),
      });
      if (!res.ok) {
        return { valid: false };
      }
      const user = (await res.json()) as {
        id?: string;
        email?: string;
        role?: string;
        name?: string | null;
        error?: string;
        statusCode?: number;
        message?: string;
      };
      if (!user?.id || !user?.email) {
        return { valid: false };
      }
      const payload: Record<string, unknown> = {
        sub: user.email,
        email: user.email,
        userId: user.id,
        role: user.role ?? 'developer',
      };
      if (user.name) payload.name = user.name;
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_SEC });
      return {
        valid: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role ?? 'developer',
          name: user.name ?? null,
        },
      };
    } catch {
      return { valid: false };
    }
  }
}
