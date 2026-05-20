/**
 * Contexto de usuario desde cabeceras del proxy API (OTP / MCP).
 */
export interface CredentialActor {
  userId?: string;
  role?: string;
}

export function actorFromHeaders(headers: Record<string, string | string[] | undefined>): CredentialActor {
  const userId = headers['x-user-id'];
  const role = headers['x-user-role'];
  return {
    userId: typeof userId === 'string' ? userId.trim() || undefined : undefined,
    role: typeof role === 'string' ? role.trim() || undefined : undefined,
  };
}

export function isAdmin(actor: CredentialActor): boolean {
  return actor.role === 'admin';
}
