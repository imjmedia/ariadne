/**
 * Formulario de alta de credencial (POST /credentials). Reutilizable en modal o página.
 */
import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { api, API_BASE } from '@/api';
import type { CreateCredentialDto } from '@/types';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const CREATE_CREDENTIAL_FORM_ID = 'create-credential-form';

/** Sin sombra: los contenedores con overflow recortan box-shadow y se ve “cortado”. */
const fieldClass = cn(
  'h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-none',
  'text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]',
  'transition-[color,border-color] duration-150',
  'focus-visible:border-[var(--border)] focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
  '[&:autofill]:border-[var(--border)] [&:autofill]:shadow-[inset_0_0_0_1000px_var(--card)] [&:autofill]:[-webkit-text-fill-color:var(--foreground)]',
);

const selectTriggerClass = cn(
  'h-11 w-full min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-none',
  'text-left text-sm font-normal text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]',
  'transition-[color,border-color,background-color] duration-150',
  'focus-visible:border-[var(--border)] focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/18 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]',
);

const labelClass = 'text-sm font-medium text-[var(--foreground)]';
const hintClass = 'text-sm leading-normal text-[var(--foreground-muted)]';

const guideSectionClass = 'space-y-2.5 text-sm leading-relaxed text-[var(--foreground)]';
const guideListClass = 'm-0 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-[var(--foreground)]';
const guideStrongClass = 'font-semibold text-[var(--foreground)]';

type GuideProps = {
  showWebhookHelp: boolean;
  showAppPasswordHelp: boolean;
  showTokenHelp: boolean;
  provider: 'bitbucket' | 'github';
  bitbucketWebhookUrl: string;
};

/**
 * Pasos para obtener token / secret (contenido del popover de guía).
 */
function CredentialCreationGuideBody({
  showWebhookHelp,
  showAppPasswordHelp,
  showTokenHelp,
  provider,
  bitbucketWebhookUrl,
}: GuideProps) {
  return (
    <div className="space-y-5">
      {showWebhookHelp ? (
        <section className={guideSectionClass} aria-labelledby="guide-webhook-heading">
          <h4 id="guide-webhook-heading" className="text-sm font-semibold text-[var(--foreground)]">
            Webhook en Bitbucket
          </h4>
          <ol className={guideListClass}>
            <li>
              Repo → <span className={guideStrongClass}>Repository settings</span> →{' '}
              <span className={guideStrongClass}>Webhooks</span> → Add webhook
            </li>
            <li>
              <span className={guideStrongClass}>URL:</span>{' '}
              <code className="break-all rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px]">
                {bitbucketWebhookUrl}
              </code>
            </li>
            <li>
              <span className={guideStrongClass}>Triggers:</span> Push (o Repository push)
            </li>
            <li>
              Pega aquí el <span className={guideStrongClass}>Secret</span> que definas en Bitbucket (debe coincidir).
            </li>
          </ol>
        </section>
      ) : null}
      {showAppPasswordHelp ? (
        <section className={guideSectionClass} aria-labelledby="guide-app-pw-heading">
          <h4 id="guide-app-pw-heading" className="text-sm font-semibold text-[var(--foreground)]">
            App password de Bitbucket
          </h4>
          <ol className={guideListClass}>
            <li>
              Bitbucket → <span className={guideStrongClass}>Personal settings</span> (engranaje) →{' '}
              <span className={guideStrongClass}>App passwords</span>
            </li>
            <li>
              <span className={guideStrongClass}>Create app password</span> → marcar:{' '}
              <span className={guideStrongClass}>Account: Read</span>,{' '}
              <span className={guideStrongClass}>Workspace membership: Read</span>,{' '}
              <span className={guideStrongClass}>Repositories: Read</span>,{' '}
              <span className={guideStrongClass}>Projects: Read</span> (opcional)
            </li>
            <li>Usuario = tu email de Bitbucket / Atlassian.</li>
            <li>Valor = la contraseña generada (solo se muestra una vez).</li>
          </ol>
        </section>
      ) : null}
      {showTokenHelp ? (
        <section className={guideSectionClass} aria-labelledby="guide-token-heading">
          <h4 id="guide-token-heading" className="text-sm font-semibold text-[var(--foreground)]">
            {provider === 'bitbucket' ? 'Token (API) de Bitbucket' : 'Personal access token de GitHub'}
          </h4>
          {provider === 'bitbucket' ? (
            <ol className={guideListClass}>
              <li>
                Perfil (esquina superior derecha) → <span className={guideStrongClass}>Account settings</span> →{' '}
                <span className={guideStrongClass}>Security</span>
              </li>
              <li>
                <span className={guideStrongClass}>Create and manage API tokens</span> → Create API token with scopes
              </li>
              <li>
                App: Bitbucket → Permisos: <span className={guideStrongClass}>Account: Read</span>,{' '}
                <span className={guideStrongClass}>Workspace membership: Read</span>,{' '}
                <span className={guideStrongClass}>Repositories: Read</span>,{' '}
                <span className={guideStrongClass}>Projects: Read</span> (opcional)
              </li>
              <li>
                <span className={guideStrongClass}>Email Atlassian:</span> el mismo que usas para iniciar sesión (Basic
                auth).
              </li>
              <li>Copia el token y pégalo en el campo «Valor» (solo se muestra una vez).</li>
            </ol>
          ) : (
            <ol className={guideListClass}>
              <li>
                GitHub → <span className={guideStrongClass}>Settings</span> →{' '}
                <span className={guideStrongClass}>Developer settings</span> → Personal access tokens
              </li>
              <li>Generate new token (classic o fine-grained).</li>
              <li>
                Scope: <span className={guideStrongClass}>repo</span> (o permisos de lectura de repositorios).
              </li>
              <li>Copia el token y pégalo en el campo «Valor» (solo se muestra una vez).</li>
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Icono de información + popover con la guía (sin segundo modal).
 */
function CredentialCreationGuidePopover({ guideProps }: { guideProps: GuideProps }) {
  const hasGuide =
    guideProps.showWebhookHelp || guideProps.showAppPasswordHelp || guideProps.showTokenHelp;
  if (!hasGuide) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--border)]',
        'bg-[color-mix(in_oklch,var(--muted)_22%,transparent)] px-3 py-2.5',
      )}
    >
      <Popover modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Clic para abrir la guía paso a paso"
            className={cn(
              'size-10 shrink-0 rounded-full text-[var(--foreground-muted)]',
              'hover:bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] hover:text-[var(--foreground)]',
              'focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/20',
            )}
            aria-label="Abrir guía paso a paso para obtener la credencial"
          >
            <Info className="size-5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            'w-[min(calc(100vw-2rem),22rem)] max-w-md border-[var(--border)] bg-[var(--card)] p-0 shadow-lg sm:w-96',
            'max-h-[min(70vh,28rem)] overflow-hidden',
          )}
        >
          <div className="border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] px-4 py-3">
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Guía</p>
            <p className="mt-1 text-xs leading-snug text-[var(--foreground-muted)]">
              Cierra con Escape o pulsando fuera del panel.
            </p>
          </div>
          <div className="max-h-[min(58vh,24rem)] overflow-y-auto px-4 py-3">
            <CredentialCreationGuideBody {...guideProps} />
          </div>
        </PopoverContent>
      </Popover>
      <p className="m-0 min-w-0 flex-1 text-xs leading-snug text-[var(--foreground-muted)] sm:text-sm">
        Pasa el cursor sobre el icono para la pista; pulsa para ver los pasos en{' '}
        {guideProps.provider === 'bitbucket' ? 'Bitbucket' : 'GitHub'} según el tipo elegido.
      </p>
    </div>
  );
}

export type CreateCredentialFormProps = {
  /** Tras POST correcto (antes de cerrar modal). */
  onSuccess: () => void;
  /** Cancelar / cerrar sin guardar. */
  onCancel: () => void;
  /** Clases en el contenedor del formulario (campos). */
  className?: string;
};

/**
 * Campos de creación; la guía se muestra en un popover anclado al icono de información (sin segundo modal).
 */
export function CreateCredentialForm({ onSuccess, onCancel, className }: CreateCredentialFormProps) {
  const formErrorId = useId();
  const [dto, setDto] = useState<CreateCredentialDto>({
    provider: 'bitbucket',
    kind: 'token',
    value: '',
    name: '',
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kinds: CreateCredentialDto['kind'][] =
    dto.provider === 'github' ? ['token'] : ['token', 'app_password', 'webhook_secret'];
  const showUsername = dto.kind === 'app_password';
  const showTokenEmail = dto.provider === 'bitbucket' && dto.kind === 'token';
  const showWebhookHelp = dto.provider === 'bitbucket' && dto.kind === 'webhook_secret';
  const showAppPasswordHelp = dto.provider === 'bitbucket' && dto.kind === 'app_password';
  const showTokenHelp = dto.kind === 'token';

  const bitbucketWebhookUrl = `${API_BASE}/webhooks/bitbucket`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload: CreateCredentialDto = {
      ...dto,
      name: dto.name || null,
      extra:
        showUsername && username
          ? { username }
          : showTokenEmail && email
            ? { email: email.trim() }
            : null,
    };
    void api
      .createCredential(payload)
      .then(() => {
        onSuccess();
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  const guideProps: GuideProps = {
    showWebhookHelp,
    showAppPasswordHelp,
    showTokenHelp,
    provider: dto.provider,
    bitbucketWebhookUrl,
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-clip px-1 py-2">
            {error ? (
              <Alert variant="destructive" className="rounded-xl" id={formErrorId} role="alert">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-sm leading-normal">{error}</AlertDescription>
              </Alert>
            ) : null}
            <form id={CREATE_CREDENTIAL_FORM_ID} onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="cred-provider" className={labelClass}>
                    Provider
                  </Label>
                  <Select
                    value={dto.provider}
                    onValueChange={(v) =>
                      setDto((x) => ({
                        ...x,
                        provider: v as 'bitbucket' | 'github',
                        kind: v === 'github' ? 'token' : x.kind,
                      }))
                    }
                  >
                    <SelectTrigger id="cred-provider" className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bitbucket">Bitbucket</SelectItem>
                      <SelectItem value="github">GitHub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cred-kind" className={labelClass}>
                    Tipo
                  </Label>
                  <Select
                    value={dto.kind}
                    onValueChange={(v) => setDto((x) => ({ ...x, kind: v as CreateCredentialDto['kind'] }))}
                  >
                    <SelectTrigger id="cred-kind" className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kinds.includes('token') ? (
                        <SelectItem value="token">Token (PAT / OAuth)</SelectItem>
                      ) : null}
                      {kinds.includes('app_password') ? (
                        <SelectItem value="app_password">App password</SelectItem>
                      ) : null}
                      {kinds.includes('webhook_secret') ? (
                        <SelectItem value="webhook_secret">Webhook secret</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <CredentialCreationGuidePopover guideProps={guideProps} />

              {showUsername ? (
                <div className="space-y-2">
                  <Label htmlFor="cred-username" className={labelClass}>
                    Usuario Bitbucket
                  </Label>
                  <Input
                    id="cred-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="email@ejemplo.com"
                    className={fieldClass}
                    autoComplete="username"
                  />
                </div>
              ) : null}
              {showTokenEmail ? (
                <div className="space-y-2">
                  <Label htmlFor="cred-email" className={labelClass}>
                    Email Atlassian <span className="font-normal text-[var(--foreground-muted)]">(requerido)</span>
                  </Label>
                  <Input
                    id="cred-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className={fieldClass}
                    autoComplete="email"
                  />
                  <p className={hintClass}>
                    El email de tu cuenta Atlassian. Los API tokens usan Basic auth (email:token).
                  </p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="cred-value" className={labelClass}>
                  Valor (token / password / secret){' '}
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                  <span className="sr-only"> obligatorio</span>
                </Label>
                <Input
                  id="cred-value"
                  type="password"
                  required
                  value={dto.value}
                  onChange={(e) => setDto((x) => ({ ...x, value: e.target.value }))}
                  placeholder="••••••••"
                  className={fieldClass}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cred-name" className={labelClass}>
                  Nombre interno <span className="font-normal text-[var(--foreground-muted)]">(opcional)</span>
                </Label>
                <Input
                  id="cred-name"
                  type="text"
                  name="credential-display-name"
                  value={dto.name ?? ''}
                  onChange={(e) => setDto((x) => ({ ...x, name: e.target.value || null }))}
                  placeholder="p. ej. Workspace producción"
                  className={fieldClass}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                />
                <p className={hintClass}>Solo para identificarla en listas; no se envía al proveedor.</p>
              </div>
            </form>
          </div>

      <div
        className={cn(
          'mt-5 flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--border)] pt-5',
          'bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] sm:flex-row sm:justify-end sm:gap-3',
        )}
        role="group"
        aria-label="Acciones del formulario"
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl sm:min-w-[8rem]"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form={CREATE_CREDENTIAL_FORM_ID}
          className="h-11 rounded-xl sm:min-w-[10rem]"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Creando…' : 'Crear credencial'}
        </Button>
      </div>
    </div>
  );
}
