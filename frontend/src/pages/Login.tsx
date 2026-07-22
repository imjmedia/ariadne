/**
 * Login básico (email+password) + OTP opcional.
 * Si no hay usuarios registrados, redirige a /setup.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Shield, CircleCheck, Lock, KeyRound } from 'lucide-react';
import { AriadneLogo } from '@/components/brand/AriadneLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginPageFooter } from '@/components/login/LoginPageFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isValidEmailFormat } from '@/utils/emailFormat';
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
  loginWithPassword,
  setToken,
  getToken,
  isTokenExpired,
} from '../utils/auth';
import { getApiBase } from '@/lib/api-base';

const API_BASE = getApiBase();

type Step = 'password' | 'otp-email' | 'otp-code';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email requerido');
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setError('Introduce un correo válido (incluye dominio, ej. empresa.com)');
      return;
    }
    if (!password) {
      setError('Contraseña requerida');
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithPassword(trimmed, password);
      if (result.valid && result.token) {
        if (result.user) {
          setToken(result.token);
          localStorage.setItem('ariadne_user', JSON.stringify(result.user));
        } else {
          setToken(result.token);
        }
        navigate('/dashboard', { replace: true });
      } else {
        setError('Email o contraseña incorrectos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email requerido');
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setError('Introduce un correo válido (incluye dominio, ej. empresa.com)');
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(trimmed);
      if (result.devCode) setDevCode(result.devCode);
      setStep('otp-code');
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

  const token = getToken();
  const emailTrimmed = email.trim();
  const emailValid = isValidEmailFormat(emailTrimmed);

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

        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-8 pt-16 sm:px-8 lg:pt-12">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[min(55vh,28rem)] bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_65%)]"
            aria-hidden
          />
          <div className="relative flex w-full max-w-lg flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <h1 className="sr-only">Ariadne</h1>
              <AriadneLogo
                variant="full"
                className="shrink-0 justify-center"
                imageClassName="h-6 w-auto max-h-6 object-contain object-center sm:h-[1.875rem] sm:max-h-[1.875rem] max-w-[min(18rem,90vw)]"
              />
              <p className="max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
                Mapa de arquitectura y conocimiento del código
              </p>
            </div>

            {step === 'password' ? (
              <>
                <div className="relative w-full max-w-md">
                  <div
                    className="pointer-events-none absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-[var(--primary)]/35 via-[var(--primary)]/8 to-transparent opacity-70 blur-md"
                    aria-hidden
                  />
                  <Card className="relative overflow-hidden rounded-3xl border-[var(--primary)]/25 bg-[var(--card)]/85 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_12%,transparent),0_25px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    <CardHeader className="flex flex-col items-center gap-3 border-0 px-6 pb-2 pt-8 text-center">
                      <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Iniciar sesión
                      </CardTitle>
                      <CardDescription className="max-w-[22rem] text-balance text-base leading-relaxed">
                        Accede con tu correo y contraseña.
                      </CardDescription>
                      <Badge
                        variant="outline"
                        className="mx-auto w-fit gap-1.5 rounded-full border-[var(--primary)]/35 px-3 py-1 text-[var(--foreground)]"
                      >
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        Login básico
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-5 px-6 pb-8 pt-4">
                      <form
                        id="login-password-form"
                        onSubmit={handlePasswordLogin}
                        className="flex w-full max-w-sm flex-col items-center gap-4"
                      >
                        <div className="flex w-full flex-col gap-2">
                          <Label
                            htmlFor="email"
                            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]"
                          >
                            Correo
                          </Label>
                          <div className="relative w-full">
                            <Mail
                              strokeWidth={2.5}
                              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-5 -translate-y-1/2 text-[var(--foreground)] dark:text-[var(--primary)]"
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
                              className={cn(
                                'h-12 border-[var(--border)]/80 bg-[var(--background)]/40 pl-11 text-left text-base backdrop-blur-sm placeholder:text-[var(--foreground-muted)]',
                                emailValid ? 'pr-11' : 'pr-3.5',
                              )}
                              autoComplete="email"
                              aria-invalid={emailTrimmed.length > 0 && !emailValid}
                            />
                            {emailValid ? (
                              <CircleCheck
                                className="pointer-events-none absolute right-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-[var(--success)]"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                          <Label
                            htmlFor="password"
                            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]"
                          >
                            Contraseña
                          </Label>
                          <div className="relative w-full">
                            <KeyRound
                              strokeWidth={2.5}
                              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-5 -translate-y-1/2 text-[var(--foreground)] dark:text-[var(--primary)]"
                              aria-hidden
                            />
                            <Input
                              id="password"
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={loading}
                              className="h-12 border-[var(--border)]/80 bg-[var(--background)]/40 pl-11 text-left text-base backdrop-blur-sm placeholder:text-[var(--foreground-muted)]"
                              autoComplete="current-password"
                            />
                          </div>
                        </div>
                        {error && (
                          <p className="text-center text-sm text-[var(--destructive)]">
                            {error}
                          </p>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>
                <Button
                  type="submit"
                  form="login-password-form"
                  className="h-12 w-full max-w-sm rounded-xl text-base font-semibold shadow-lg shadow-[var(--primary)]/15"
                  disabled={loading || !emailValid || !password}
                >
                  {loading ? 'Entrando…' : 'Entrar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full max-w-sm text-sm text-[var(--foreground-muted)]"
                  onClick={() => {
                    setStep('otp-email');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Usar código por correo (OTP)
                </Button>
                {ssoEnabled && (
                  <div className="flex w-full max-w-sm flex-col gap-3">
                    <div className="relative flex items-center gap-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--border)]" />
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest text-[var(--foreground-muted)]">
                        o continúa con
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--border)]" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-[var(--border)]/80"
                      onClick={handleSsoRedirect}
                      disabled={loading}
                    >
                      Iniciar sesión con SSO
                    </Button>
                  </div>
                )}
              </>
            ) : step === 'otp-email' ? (
              <>
                <div className="relative w-full max-w-md">
                  <div
                    className="pointer-events-none absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-[var(--primary)]/35 via-[var(--primary)]/8 to-transparent opacity-70 blur-md"
                    aria-hidden
                  />
                  <Card className="relative overflow-hidden rounded-3xl border-[var(--primary)]/25 bg-[var(--card)]/85 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_12%,transparent),0_25px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    <CardHeader className="flex flex-col items-center gap-3 border-0 px-6 pb-2 pt-8 text-center">
                      <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Acceso con código
                      </CardTitle>
                      <CardDescription className="max-w-[22rem] text-balance text-base leading-relaxed">
                        Ingresa tu correo registrado para recibir el código de acceso.
                      </CardDescription>
                      <Badge
                        variant="outline"
                        className="mx-auto w-fit gap-1.5 rounded-full border-[var(--primary)]/35 px-3 py-1 text-[var(--foreground)]"
                      >
                        <Shield className="size-3.5 shrink-0" aria-hidden />
                        OTP
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-5 px-6 pb-8 pt-4">
                      <form
                        id="login-email-form"
                        onSubmit={handleRequestOtp}
                        className="flex w-full max-w-sm flex-col items-center gap-5"
                      >
                        <div className="flex w-full flex-col items-center gap-2">
                          <Label
                            htmlFor="otp-email"
                            className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]"
                          >
                            Correo corporativo
                          </Label>
                          <div className="relative w-full">
                            <Mail
                              strokeWidth={2.5}
                              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-5 -translate-y-1/2 text-[var(--foreground)] dark:text-[var(--primary)]"
                              aria-hidden
                            />
                            <Input
                              id="otp-email"
                              type="email"
                              placeholder="tu@empresa.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              disabled={loading}
                              autoFocus
                              className={cn(
                                'h-12 border-[var(--border)]/80 bg-[var(--background)]/40 pl-11 text-left text-base backdrop-blur-sm placeholder:text-[var(--foreground-muted)]',
                                emailValid ? 'pr-11' : 'pr-3.5',
                              )}
                              autoComplete="email"
                              aria-invalid={emailTrimmed.length > 0 && !emailValid}
                            />
                            {emailValid ? (
                              <CircleCheck
                                className="pointer-events-none absolute right-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-[var(--success)]"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        </div>
                        {error && (
                          <p className="text-center text-sm text-[var(--destructive)]">
                            {error}
                          </p>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>
                <Button
                  type="submit"
                  form="login-email-form"
                  className="h-12 w-full max-w-sm rounded-xl text-base font-semibold shadow-lg shadow-[var(--primary)]/15"
                  disabled={loading || !emailValid}
                >
                  {loading ? 'Enviando…' : 'Enviar código'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full max-w-sm rounded-xl border-[var(--border)]/80"
                  onClick={() => {
                    setStep('password');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Volver a contraseña
                </Button>
              </>
            ) : (
              <>
                <div className="relative w-full max-w-md">
                  <div
                    className="pointer-events-none absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-[var(--primary)]/35 via-[var(--primary)]/8 to-transparent opacity-70 blur-md"
                    aria-hidden
                  />
                  <Card className="relative overflow-hidden rounded-3xl border-[var(--primary)]/25 bg-[var(--card)]/85 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_12%,transparent),0_25px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                    <CardHeader className="flex flex-col items-center gap-2 border-0 px-6 pb-2 pt-8 text-center">
                      <CardTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                        Verificar código
                      </CardTitle>
                      <CardDescription className="max-w-[22rem] text-balance">
                        Ingresa el código de 6 dígitos enviado a tu correo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center px-6 pb-8 pt-4">
                      <form
                        id="login-code-form"
                        onSubmit={handleVerifyOtp}
                        className="flex w-full max-w-sm flex-col items-center gap-5"
                      >
                        <p className="text-center text-sm text-[var(--foreground-muted)]">
                          Código enviado a{' '}
                          <strong className="text-[var(--foreground)]">{email}</strong>
                        </p>
                        {devCode && (
                          <p className="w-full rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning)]/15 px-4 py-2 text-center text-sm text-[var(--foreground)]">
                            Modo dev: código{' '}
                            <code className="font-mono font-bold">{devCode}</code>
                          </p>
                        )}
                        <div className="flex w-full flex-col items-center gap-2">
                          <Label
                            htmlFor="code"
                            className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground-muted)]"
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
                            className="h-12 max-w-[13rem] border-[var(--border)]/80 bg-[var(--background)]/40 text-center font-mono text-xl tracking-[0.4em] backdrop-blur-sm"
                          />
                        </div>
                        {error && (
                          <p className="text-center text-sm text-[var(--destructive)]">
                            {error}
                          </p>
                        )}
                      </form>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex w-full max-w-sm flex-col gap-3">
                  <Button
                    type="submit"
                    form="login-code-form"
                    className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-[var(--primary)]/15"
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? 'Verificando…' : 'Verificar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[var(--border)]/80"
                    onClick={() => {
                      setStep('otp-email');
                      setCode('');
                      setError(null);
                      setDevCode(null);
                    }}
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
