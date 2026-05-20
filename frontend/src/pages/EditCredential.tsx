/**
 * @fileoverview Formulario para editar credencial existente (nombre, valor, propietario).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Credential, UpdateCredentialDto } from '../types';
import { getUser } from '../utils/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type PlatformUser = { id: string; email: string; name?: string | null };

/** Página de edición de credencial. PATCH /credentials/:id */
export function EditCredential() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionUser = getUser();
  const isAdmin = sessionUser?.role === 'admin';

  const [cred, setCred] = useState<Credential | null>(null);
  const [dto, setDto] = useState<UpdateCredentialDto>({ name: null });
  const [assignUserId, setAssignUserId] = useState<string>('__legacy__');
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getCredential(id)
      .then((c) => {
        setCred(c);
        setDto({ name: c.name ?? null });
        setAssignUserId(c.userId ?? '__legacy__');
        if (c.kind === 'app_password' && c.extra?.username) setUsername(String(c.extra.username));
        if (c.kind === 'token' && c.provider === 'bitbucket' && c.extra?.email) {
          setEmail(String(c.extra.email));
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    void api
      .getUsers()
      .then((rows) => {
        const list = (rows as PlatformUser[]).filter((u) => u?.id && u?.email);
        setPlatformUsers(list);
      })
      .catch(() => setPlatformUsers([]));
  }, [isAdmin]);

  const ownerLabel = useMemo(() => {
    if (!cred) return '';
    if (!cred.userId) return 'Sin asignar (legado / plataforma)';
    if (cred.userId === sessionUser?.id) return 'Tú';
    if (cred.ownerEmail) return cred.ownerEmail;
    return cred.userId;
  }, [cred, sessionUser?.id]);

  const canClaim =
    cred &&
    cred.kind !== 'webhook_secret' &&
    !cred.userId &&
    sessionUser?.id;

  const buildExtra = (): UpdateCredentialDto['extra'] => {
    if (cred?.kind === 'app_password' && username) return { username };
    if (cred?.kind === 'token' && cred?.provider === 'bitbucket') return { email: email.trim() };
    return undefined;
  };

  const buildUserIdPatch = (): string | null | undefined => {
    if (!isAdmin || !cred) return undefined;
    const initialKey = cred.userId ?? '__legacy__';
    if (assignUserId === initialKey) return undefined;
    if (assignUserId === '__legacy__') return null;
    return assignUserId;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: UpdateCredentialDto = {
        name: dto.name || null,
        extra: buildExtra(),
      };
      if (dto.value != null && dto.value.trim() !== '') payload.value = dto.value.trim();
      const userIdPatch = buildUserIdPatch();
      if (userIdPatch !== undefined) payload.userId = userIdPatch;
      await api.updateCredential(id, payload);
      navigate('/credentials');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const claimMine = async () => {
    if (!id || !sessionUser?.id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.updateCredential(id, { userId: sessionUser.id });
      navigate('/credentials');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !cred) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/credentials">← Credenciales</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!cred) return null;

  const showUsername = cred.kind === 'app_password';
  const showTokenEmail = cred.kind === 'token' && cred.provider === 'bitbucket';
  const showOwnerAssign = isAdmin && cred.kind !== 'webhook_secret';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/credentials">← Credenciales</Link>
        </Button>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Editar credencial</CardTitle>
          <CardDescription>
            {cred.provider} / {cred.kind}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))] px-3 py-3">
              <Label className="text-xs text-[var(--foreground-muted)]">Propietario en Ariadne</Label>
              <p className="text-sm font-medium text-[var(--foreground)]">{ownerLabel}</p>
              {canClaim && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={submitting}
                  onClick={() => void claimMine()}
                >
                  Asignar a mi cuenta
                </Button>
              )}
              {showOwnerAssign && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="assign-user">Reasignar a usuario</Label>
                  <Select value={assignUserId} onValueChange={setAssignUserId}>
                    <SelectTrigger id="assign-user" className="h-10">
                      <SelectValue placeholder="Elegir usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__legacy__">Sin asignar (legado)</SelectItem>
                      {platformUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.email}
                          {u.name ? ` (${u.name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    El sync manual usa la credencial del usuario que pulsa Sync. Asigna esta entrada a quien
                    deba poseer el token.
                  </p>
                </div>
              )}
            </div>

            {showUsername && (
              <div className="space-y-2">
                <Label>Usuario Bitbucket</Label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>
            )}
            {showTokenEmail && (
              <div className="space-y-2">
                <Label>Email Atlassian</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
                <p className="text-xs text-[var(--foreground-muted)]">
                  Cuenta de Bitbucket/Atlassian del token, no el usuario de Ariadne.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nuevo valor (token/password)</Label>
              <p className="text-xs text-muted-foreground">
                Dejar vacío para mantener el actual. Si el token expiró o falló (401), pega aquí un token nuevo.
                Tokens de hasta 300+ caracteres se guardan completos.
              </p>
              <Input
                type="password"
                value={dto.value ?? ''}
                onChange={(e) => setDto((x) => ({ ...x, value: e.target.value || undefined }))}
                placeholder="Dejar vacío = no cambiar"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre (opcional)</Label>
              <Input
                type="text"
                value={dto.name ?? ''}
                onChange={(e) => setDto((x) => ({ ...x, name: e.target.value || null }))}
                placeholder="Mi workspace token"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/credentials">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
