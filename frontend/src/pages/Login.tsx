/**
 * Página de login con OTP: email → código.
 * Si no hay usuarios registrados, redirige a /setup.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginPageFooter } from '@/components/login/LoginPageFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  requestOtp,
  verifyOtp,
  setToken,
  getToken,
  isTokenExpired,
} from '../utils/auth';

const API_BASE =
  ((import.meta.env.VITE_API_URL as string) || 'http://localhost:3000').replace(
    /\/$/,
    '',
  ) + '/api';

type Step = 'email' | 'code' | 'sso';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  const checkNeedsSetup = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/has-users`);
      const data = (await res.json()) as { hasUsers?: boolean };
      if (data.hasUsers === false) {
        navigate('/setup', { replace: true });
      }
    } catch {
      // Si falla la consulta, continuar con login normal
    }
  }, [navigate]);

  const handleSsoLogin = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/sso/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data?.valid && data?.token) {
        setToken(data.token);
        navigate('/dashboard', { replace: true });
      } else {
        setError('Error de autenticación SSO');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error SSO');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const ssoUrl = import.meta.env.VITE_SSO_URL as string;
    if (ssoUrl?.trim()) {
      setSsoEnabled(true);
    }

    const ssoToken = searchParams.get('sso_token');
    if (ssoToken) {
      void handleSsoLogin(ssoToken);
    }

    void checkNeedsSetup();
  }, [searchParams, handleSsoLogin, checkNeedsSetup]);

  const handleSsoRedirect = () => {
    const ssoUrl = import.meta.env.VITE_SSO_URL as string;
    if (ssoUrl) {
      window.location.href = ssoUrl;
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Email requerido');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(email.trim());
      if (result.devCode) setDevCode(result.devCode);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError('Código requerido');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp(email.trim(), code.trim());
      if (result.valid && result.token) {
        if (result.user) {
          setToken(result.token);
          localStorage.setItem('ariadne_user', JSON.stringify(result.user));
        } else {
          setToken(result.token);
        }
        navigate('/dashboard', { replace: true });
      } else {
        setError('Código incorrecto o expirado');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setError(null);
    setDevCode(null);
  };

  const token = getToken();
  if (token && !isTokenExpired(token)) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="grid min-h-[100dvh] w-full bg-[var(--background)] lg:min-h-0 lg:grid-cols-2">
      <div className="relative flex min-h-[100dvh] flex-col lg:min-h-[100dvh]">
        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-20 sm:right-6">
          <ThemeToggle layout="pill" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-16 sm:px-8 lg:pt-12">
          <div className="flex w-full max-w-md flex-col gap-6">
            <div className="flex flex-col items-center gap-4 text-center lg:items-stretch lg:text-left">
              <div className="flex items-center gap-3 lg:justify-start">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--primary)]/50 bg-[var(--primary)]/10 shadow-sm"
                  aria-hidden
                >
                  <span className="text-lg font-bold text-[var(--primary)]">A</span>
                </div>
                <div className="min-w-0 text-left">
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    Ariadne
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Mapa de arquitectura y conocimiento del código
                  </p>
                </div>
              </div>
            </div>

            {step === 'email' ? (
              <>
                <Card className="border-[var(--primary)]/20 shadow-lg shadow-[var(--shadow-glow)]/30">
                  <CardHeader className="gap-3">
                    <CardTitle className="text-xl sm:text-2xl">
                      Acceso seguro
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      Ingresa tu correo registrado para recibir el código de acceso.
                    </CardDescription>
                    <Badge
                      variant="outline"
                      className="w-fit gap-1.5 border-[var(--primary)]/40 px-2 py-1 text-[var(--foreground)]"
                    >
                      <Shield className="size-3.5 shrink-0" aria-hidden />
                      Acceso sin contraseña
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="h-px w-full bg-[var(--border)]" aria-hidden />
                    <form
                      id="login-email-form"
                      onSubmit={handleRequestOtp}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-2">
                        <Label
                          htmlFor="email"
                          className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]"
                        >
                          Correo corporativo
                        </Label>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--foreground-muted)]"
                            aria-hidden
                          />
                          <Input
                            id="email"
                            type="email"
                            placeholder="tu@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            autoFocus
                            className="h-11 pl-10"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-3 text-sm text-[var(--foreground-muted)]">
                        Solo cuentas autorizadas reciben un código. Revisa spam si
                        no ves el correo en unos minutos.
                      </div>
                      {error && (
                        <p className="text-sm text-[var(--destructive)]">{error}</p>
                      )}
                    </form>
                  </CardContent>
                </Card>
                <Button
                  type="submit"
                  form="login-email-form"
                  className="h-11 w-full max-w-md text-base font-semibold"
                  disabled={loading}
                >
                  {loading ? 'Enviando…' : 'Enviar código'}
                </Button>
                {ssoEnabled && (
                  <div className="flex flex-col gap-3">
                    <div className="relative flex items-center gap-4">
                      <div className="h-px flex-1 bg-[var(--border)]" />
                      <span className="text-xs uppercase text-[var(--foreground-muted)]">
                        o
                      </span>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      onClick={handleSsoRedirect}
                      disabled={loading}
                    >
                      Iniciar sesión con SSO
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Card className="border-[var(--primary)]/20 shadow-lg shadow-[var(--shadow-glow)]/30">
                  <CardHeader className="gap-2">
                    <CardTitle className="text-xl">Verificar código</CardTitle>
                    <CardDescription>
                      Ingresa el código de 6 dígitos enviado a tu correo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      id="login-code-form"
                      onSubmit={handleVerifyOtp}
                      className="flex flex-col gap-4"
                    >
                      <p className="text-sm text-[var(--foreground-muted)]">
                        Código enviado a <strong className="text-[var(--foreground)]">{email}</strong>
                      </p>
                      {devCode && (
                        <p className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-3 py-2 text-sm text-[var(--foreground)]">
                          Modo dev: código{' '}
                          <code className="font-mono font-bold">{devCode}</code>
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        <Label
                          htmlFor="code"
                          className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]"
                        >
                          Código de acceso
                        </Label>
                        <Input
                          id="code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          enterKeyHint="done"
                          placeholder="000000"
                          maxLength={6}
                          pattern="\d{6}"
                          value={code}
                          onChange={(e) =>
                            setCode(e.target.value.replace(/\D/g, ''))
                          }
                          disabled={loading}
                          autoFocus
                          className="h-11 font-mono text-lg tracking-[0.35em]"
                        />
                      </div>
                      {error && (
                        <p className="text-sm text-[var(--destructive)]">{error}</p>
                      )}
                    </form>
                  </CardContent>
                </Card>
                <div className="flex w-full max-w-md flex-col gap-3">
                  <Button
                    type="submit"
                    form="login-code-form"
                    className="h-11 w-full text-base font-semibold"
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? 'Verificando…' : 'Verificar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={handleBack}
                    disabled={loading}
                  >
                    Volver al correo
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <LoginPageFooter />
      </div>

      <div
        className="relative hidden min-h-0 overflow-hidden lg:block"
        aria-hidden
      >
        <img
          src="/images/login-side-panel.png"
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)]/90 via-transparent to-[var(--background)]/20" />
      </div>
    </div>
  );
}
