/**
 * Perfil de usuario: datos de cuenta, secret MCP (ver/copiar/regenerar) y cierre de sesión.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  User,
  Mail,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getUser, removeToken } from '@/utils/auth';
import type { UserInfo } from '@/utils/auth';
import { api } from '@/api';
import { cn } from '@/lib/utils';

const panelIntroClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const sectionShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const sectionHeaderClass = cn(
  'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
  'px-5 py-4 sm:px-6',
);

const monoFieldClass = cn(
  'flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))]',
  'px-3 py-2 font-mono text-sm text-[var(--foreground)] shadow-none',
);

const labelMuted = 'text-xs font-medium text-[var(--foreground-muted)]';

export function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [mcpSecret, setMcpSecret] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate('/login', { replace: true });
      return;
    }
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    if (user) void fetchSecret();
  }, [user]);

  async function fetchSecret() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getMcpSecret(user.id);
      setMcpSecret(data.mcpSecret ?? '');
      setMessage(data.mcpSecret ? '' : '');
    } catch {
      setError('No se pudo cargar el secret MCP. Reintenta con «Recargar».');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!user) return;
    if (!confirm('¿Regenerar el secret MCP? El valor anterior dejará de funcionar de inmediato.')) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api.regenerateMcpToken(user.id);
      setMcpSecret(data.token);
      setVisible(true);
      setMessage('Secret regenerado. Cópialo y guárdalo en un lugar seguro; no volverá a mostrarse igual si lo ocultas.');
    } catch {
      setError('No se pudo regenerar el secret MCP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!mcpSecret) return;
    try {
      await navigator.clipboard.writeText(mcpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = mcpSecret;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleLogout() {
    if (!confirm('¿Cerrar sesión en este dispositivo?')) return;
    removeToken();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className={panelIntroClass}>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Perfil</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Datos de tu cuenta y token MCP para que el servidor de herramientas actúe con tu identidad. Regenera el secret
          si sospechas que se filtró.
        </p>
      </div>

      <section className={sectionShellClass} aria-labelledby="profile-account-heading">
        <div className={sectionHeaderClass}>
          <h2 id="profile-account-heading" className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <User className="size-5 shrink-0 text-[var(--foreground-muted)]" aria-hidden />
            Información de la cuenta
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Solo lectura; el rol lo define un administrador.</p>
        </div>
        <div className="grid gap-6 px-5 py-6 sm:grid-cols-2 sm:px-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-[var(--foreground-muted)]" aria-hidden />
              <p className={labelMuted}>Email</p>
            </div>
            <p className="break-all text-sm font-medium text-[var(--foreground)]">{user.email}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-[var(--foreground-muted)]" aria-hidden />
              <p className={labelMuted}>Rol</p>
            </div>
            <p className="text-sm font-medium capitalize text-[var(--foreground)]">{user.role}</p>
          </div>
        </div>
      </section>

      <section className={sectionShellClass} aria-labelledby="profile-mcp-heading">
        <div className={sectionHeaderClass}>
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))]"
              aria-hidden
            >
              <Shield className="size-5 text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <h2 id="profile-mcp-heading" className="text-base font-semibold text-[var(--foreground)]">
                Secret MCP
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
                Autenticación del servidor MCP como tu usuario. No lo compartas en chats ni repositorios públicos.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-5 px-5 py-6 sm:px-6">
          {message ? (
            <Alert className="rounded-xl border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
              <AlertTitle className="text-sm">Listo</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">{message}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="rounded-xl">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <p className={labelMuted}>Valor del secret</p>
            {loading && !mcpSecret ? (
              <Skeleton className="h-11 w-full rounded-xl" />
            ) : (
              <div className={cn(monoFieldClass, 'pr-1')}>
                <code className="min-w-0 flex-1 break-all">
                  {mcpSecret
                    ? visible
                      ? mcpSecret
                      : '•••••••••••••••••••••••••••••••••'
                    : 'Sin secret — usa «Regenerar» si acabas de crear la cuenta.'}
                </code>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    onClick={() => setVisible((v) => !v)}
                    disabled={!mcpSecret}
                    aria-label={visible ? 'Ocultar secret' : 'Mostrar secret'}
                  >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    onClick={() => void handleCopy()}
                    disabled={!mcpSecret}
                    aria-label="Copiar secret"
                  >
                    {copied ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-[var(--border)]"
              onClick={() => void handleRegenerate()}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Regenerar secret
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              onClick={() => void fetchSecret()}
              disabled={loading}
            >
              Recargar
            </Button>
          </div>

          <p className="m-0 text-xs leading-relaxed text-[var(--foreground-muted)]">
            Si el secret se filtra, regenera en cuanto puedas: el anterior deja de ser válido al instante.
          </p>
        </div>
      </section>

      <section
        className={cn(sectionShellClass, 'border-destructive/25 bg-[color-mix(in_oklch,var(--destructive)_6%,var(--card))]')}
        aria-labelledby="profile-session-heading"
      >
        <div className={cn(sectionHeaderClass, 'border-destructive/20 bg-[color-mix(in_oklch,var(--destructive)_8%,var(--card))]')}>
          <h2 id="profile-session-heading" className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <LogOut className="size-5 shrink-0 text-[var(--destructive)]" aria-hidden />
            Sesión
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
            Cierra la sesión en este navegador. Necesitarás OTP de nuevo para entrar.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="m-0 max-w-md text-sm text-[var(--foreground-muted)]">
            Usa esta acción en equipos compartidos o si terminas tu jornada.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="h-11 shrink-0 rounded-xl px-6 sm:min-w-[11rem]"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </section>
    </div>
  );
}
