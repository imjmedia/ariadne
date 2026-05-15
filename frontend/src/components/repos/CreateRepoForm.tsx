/**
 * @fileoverview Create repository form: Provider → Credential → workspace/repo/branch. Used in CreateRepoDialog (modal).
 */
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { KeyRound, Plus } from "lucide-react"
import { api } from "@/api"
import type { CreateRepositoryDto, Credential, Repository } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

const inputFieldClass = "h-11 rounded-xl border-[var(--border)] bg-[var(--card)]"
const selectTriggerFull = cn(
  "h-11 w-full min-w-0 justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 shadow-sm",
  "text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--card)]",
  "focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0",
)

/** Etiqueta del primer selector según provider (Bitbucket: Workspace, GitHub: Owner). */
const workspaceLabel = (provider: string) => (provider === 'github' ? 'Owner' : 'Workspace');
/** Etiqueta del selector de repo (GitHub: Repositorio, Bitbucket: Proyecto). */
const projectLabel = (provider: string) => (provider === 'github' ? 'Repositorio' : 'Proyecto');

type CredentialsFormFieldsProps = {
  dto: CreateRepositoryDto;
  setDto: React.Dispatch<React.SetStateAction<CreateRepositoryDto>>;
  provider: 'bitbucket' | 'github';
  workspaces: Array<{ slug: string; name?: string }>;
  owners: Array<{ login: string }>;
  repositories: Array<{ slug?: string; name?: string; default_branch?: string }>;
  branches: string[];
  loadingDiscovery: boolean;
};

/** Bloques de formulario cuando hay credencial: workspace/owner, proyecto/repo, branch, webhook (Bitbucket). */
function CredentialsFormFields({
  dto,
  setDto,
  provider,
  workspaces,
  owners,
  repositories,
  branches,
  loadingDiscovery,
}: CredentialsFormFieldsProps) {
  const wLabel = workspaceLabel(provider);
  const pLabel = projectLabel(provider);
  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-[var(--foreground-muted)]">{wLabel}</Label>
        <Select
          value={dto.projectKey}
          onValueChange={(v) =>
            setDto((x) => ({ ...x, projectKey: v, repoSlug: '', defaultBranch: 'main' }))
          }
          disabled={loadingDiscovery}
        >
          <SelectTrigger className={selectTriggerFull}>
            <SelectValue placeholder={loadingDiscovery ? 'Cargando…' : 'Seleccionar'} />
          </SelectTrigger>
          <SelectContent>
            {provider === 'bitbucket'
              ? workspaces.map((w) => (
                  <SelectItem key={w.slug} value={w.slug}>
                    {w.name ?? w.slug}
                  </SelectItem>
                ))
              : owners.map((o) => (
                  <SelectItem key={o.login} value={o.login}>
                    {o.login}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>
      {dto.projectKey && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[var(--foreground-muted)]">{pLabel}</Label>
          <Select
            value={dto.repoSlug}
            onValueChange={(v) => setDto((x) => ({ ...x, repoSlug: v }))}
          >
            <SelectTrigger className={selectTriggerFull}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {repositories.map((r) => {
                const val = r.slug ?? r.name ?? '';
                return (
                  <SelectItem key={val} value={val}>
                    {r.name ?? r.slug ?? val}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-[var(--foreground-muted)]">Repo slug (editable)</Label>
        <Input
          required
          value={dto.repoSlug}
          onChange={(e) => setDto((x) => ({ ...x, repoSlug: e.target.value }))}
          placeholder="my-repo"
          className={inputFieldClass}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-[var(--foreground-muted)]">Branch por defecto</Label>
        <Select
          value={dto.defaultBranch ?? 'main'}
          onValueChange={(v) => setDto((x) => ({ ...x, defaultBranch: v }))}
          disabled={branches.length === 0}
        >
          <SelectTrigger className={selectTriggerFull}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {provider === 'bitbucket' && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-[var(--foreground-muted)]">Webhook secret (opcional)</Label>
          <p className="text-xs text-[var(--foreground-muted)]">
            Si configuras un webhook en Bitbucket, usa el mismo secret aquí para validar las
            peticiones.
          </p>
          <Input
            type="password"
            value={dto.webhookSecret ?? ''}
            onChange={(e) =>
              setDto((x) => ({ ...x, webhookSecret: e.target.value || null }))
            }
            placeholder="Opcional. El mismo valor que en Bitbucket → Webhooks"
            className={inputFieldClass}
          />
        </div>
      )}
    </>
  );
}

/** Carga workspaces/owners, repos y branches según credencial y dto. Reduce anidamiento en CreateRepo. */
function useCreateRepoDiscovery(
  dto: CreateRepositoryDto,
  setDto: React.Dispatch<React.SetStateAction<CreateRepositoryDto>>,
  credentialsRef: string | null,
  setError: (msg: string | null) => void,
) {
  const [workspaces, setWorkspaces] = useState<Array<{ slug: string; name?: string }>>([]);
  const [owners, setOwners] = useState<Array<{ login: string }>>([]);
  const [repositories, setRepositories] = useState<
    Array<{ slug?: string; name?: string; default_branch?: string }>
  >([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);

  useEffect(() => {
    if (!credentialsRef) {
      setWorkspaces([]);
      setOwners([]);
      setRepositories([]);
      setBranches([]);
      return;
    }
    setLoadingDiscovery(true);
    setError(null);
    if (dto.provider === 'bitbucket') {
      api
        .listBitbucketWorkspaces(credentialsRef)
        .then(setWorkspaces)
        .catch((e) => {
          setWorkspaces([]);
          setError(e.message);
        })
        .finally(() => setLoadingDiscovery(false));
    } else {
      api
        .listGitHubOwners(credentialsRef)
        .then(setOwners)
        .catch((e) => {
          setOwners([]);
          setError(e.message);
        })
        .finally(() => setLoadingDiscovery(false));
    }
  }, [dto.provider, credentialsRef, setError]);

  useEffect(() => {
    if (!credentialsRef) return;
    if (dto.provider === 'bitbucket' && dto.projectKey) {
      api
        .listBitbucketRepositories(dto.projectKey, credentialsRef)
        .then(setRepositories)
        .catch(() => setRepositories([]));
    } else if (dto.provider === 'github' && dto.projectKey) {
      api
        .listGitHubRepositories(dto.projectKey, credentialsRef)
        .then(setRepositories)
        .catch(() => setRepositories([]));
    } else {
      setRepositories([]);
    }
  }, [dto.provider, credentialsRef, dto.projectKey]);

  useEffect(() => {
    if (repositories.length === 0) return;
    const suggested =
      dto.provider === 'bitbucket'
        ? repositories.find((r) => r.slug)?.slug ?? repositories[0]?.name
        : repositories[0]?.name;
    if (suggested && !dto.repoSlug) {
      setDto((x) => ({ ...x, repoSlug: suggested }));
    }
  }, [dto.provider, repositories, dto.repoSlug, setDto]);

  useEffect(() => {
    if (!credentialsRef || !dto.projectKey || !dto.repoSlug) {
      setBranches([]);
      return;
    }
    if (dto.provider === 'bitbucket') {
      api
        .listBitbucketBranches(dto.projectKey, dto.repoSlug, credentialsRef)
        .then((r) => {
          setBranches(r.branches);
          setDto((x) => ({
            ...x,
            defaultBranch:
              r.branches.includes('main') ? 'main' : r.branches.includes('master') ? 'master' : r.branches[0] ?? 'main',
          }));
        })
        .catch(() => setBranches([]));
    } else {
      api
        .listGitHubBranches(dto.projectKey, dto.repoSlug, credentialsRef)
        .then((r) => {
          setBranches(r.branches);
          const def =
            repositories.find((re) => (re.slug ?? re.name) === dto.repoSlug)?.default_branch ?? 'main';
          setDto((x) => ({
            ...x,
            defaultBranch: r.branches.includes(def) ? def : r.branches[0] ?? 'main',
          }));
        })
        .catch(() => setBranches([]));
    }
  }, [dto.provider, credentialsRef, dto.projectKey, dto.repoSlug, repositories, setDto]);

  return { workspaces, owners, repositories, branches, loadingDiscovery };
}

function CreateRepoProviderSelect({
  provider,
  onProviderChange,
  onCredentialReset,
}: {
  provider: string;
  onProviderChange: (v: 'bitbucket' | 'github') => void;
  onCredentialReset: () => void;
}) {
  const handleChange = (v: string) => {
    onProviderChange(v as 'bitbucket' | 'github');
    onCredentialReset();
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-[var(--foreground-muted)]">Provider</Label>
      <Select value={provider} onValueChange={handleChange}>
        <SelectTrigger className={selectTriggerFull}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bitbucket">Bitbucket</SelectItem>
          <SelectItem value="github">GitHub</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateRepoCredentialSelect({
  credentialsRef,
  credentials,
  onCredentialChange,
  onDtoReset,
}: {
  credentialsRef: string | null;
  credentials: Credential[];
  onCredentialChange: (id: string | null) => void;
  onDtoReset: () => void;
}) {
  const handleChange = (v: string) => {
    onCredentialChange(v === '__none__' ? null : v);
    onDtoReset();
  };
  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-[var(--foreground-muted)]">Credencial (requerida)</Label>
      <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
        Crea una en{" "}
        <Link
          to="/credentials?create=1"
          className="font-medium text-[var(--primary)] underline underline-offset-4 hover:underline"
        >
          Credenciales → Nueva
        </Link>{" "}
        si no tienes ninguna. Sin credencial no se pueden listar workspaces ni repos.
      </p>
      <Select value={credentialsRef ?? "__none__"} onValueChange={handleChange}>
        <SelectTrigger className={selectTriggerFull}>
          <SelectValue placeholder="Selecciona una credencial" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Seleccionar —</SelectItem>
          {credentials.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name ?? `${c.provider} / ${c.kind}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {credentials.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border border-dashed border-[var(--border)] p-4",
            "bg-[color-mix(in_oklch,var(--muted)_45%,transparent)]",
          )}
        >
          <p className="m-0 text-xs font-medium text-[var(--foreground)]">No hay credenciales para este provider</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
            Registra un token o PAT; luego vuelve aquí y el desplegable se llenará solo.
          </p>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "mt-4 h-11 w-full gap-2 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm font-medium shadow-sm",
              "text-[var(--foreground)] transition-colors",
              "hover:border-[color-mix(in_oklch,var(--primary)_40%,var(--border))]",
              "hover:bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] hover:text-[var(--primary)]",
            )}
            asChild
          >
            <Link to="/credentials?create=1" className="inline-flex items-center justify-center">
              <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <KeyRound className="size-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
              <span>Añadir credencial</span>
              <span className="text-xs font-normal text-[var(--foreground-muted)]">· token / PAT</span>
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type CreateRepoFormProps = {
  /** When set, repository is linked to this project after create (multi-root). */
  projectIdFromUrl?: string | null
  variant: "page" | "dialog"
  /** If set, called after successful create instead of internal navigation. */
  onSuccess?: (repo: Repository) => void
  /** If set, Cancel uses this callback; otherwise navigates back to repos or project. */
  onCancel?: () => void
  /** Emitted when async submit starts or ends (e.g. disable dialog dismiss). */
  onBusyChange?: (busy: boolean) => void
}

/**
 * Form: Provider → Credential → workspace/repo/branch. POST /repositories.
 */
export function CreateRepoForm({
  projectIdFromUrl = null,
  variant,
  onSuccess,
  onCancel,
  onBusyChange,
}: CreateRepoFormProps) {
  const navigate = useNavigate()
  const [dto, setDto] = useState<CreateRepositoryDto>({
    provider: "bitbucket",
    projectKey: "",
    repoSlug: "",
    defaultBranch: "main",
    webhookSecret: null,
  })
  const [credentialsRef, setCredentialsRef] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onBusyChange?.(submitting)
  }, [submitting, onBusyChange])

  useEffect(() => {
    api.getCredentials(dto.provider).then(setCredentials).catch(() => setCredentials([]))
  }, [dto.provider])

  const discovery = useCreateRepoDiscovery(dto, setDto, credentialsRef, setError)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!credentialsRef) {
      setError("Selecciona una credencial para continuar.")
      return
    }
    setSubmitting(true)
    api
      .createRepository({
        ...dto,
        credentialsRef,
        webhookSecret: dto.webhookSecret?.trim() || null,
        projectId: projectIdFromUrl ?? null,
      })
      .then((r) => {
        setSubmitting(false)
        if (onSuccess) onSuccess(r)
        else navigate(projectIdFromUrl ? `/projects/${projectIdFromUrl}` : `/repos/${r.id}`)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setSubmitting(false)
      })
  }

  const resetDtoKeys = () => setDto((x) => ({ ...x, projectKey: "", repoSlug: "", defaultBranch: "main" }))

  const cancelHref = projectIdFromUrl ? `/projects/${projectIdFromUrl}` : "/repos"

  const formInner = (
    <>
      {error ? (
        <Alert variant="destructive" className={cn(variant === "page" && "mb-4")}>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit} className="space-y-5">
        <CreateRepoProviderSelect
          provider={dto.provider}
          onProviderChange={(v) =>
            setDto((x) => ({ ...x, provider: v, projectKey: "", repoSlug: "", defaultBranch: "main" }))
          }
          onCredentialReset={() => setCredentialsRef(null)}
        />
        <CreateRepoCredentialSelect
          credentialsRef={credentialsRef}
          credentials={credentials}
          onCredentialChange={setCredentialsRef}
          onDtoReset={resetDtoKeys}
        />
        {credentialsRef ? (
          <CredentialsFormFields
            dto={dto}
            setDto={setDto}
            provider={dto.provider}
            workspaces={discovery.workspaces}
            owners={discovery.owners}
            repositories={discovery.repositories}
            branches={discovery.branches}
            loadingDiscovery={discovery.loadingDiscovery}
          />
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="submit"
            className="h-11 rounded-xl"
            disabled={submitting || !credentialsRef || !dto.projectKey || !dto.repoSlug}
          >
            {submitting ? "Creando…" : "Crear repositorio"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" className="h-11 rounded-xl border-[var(--border)]" onClick={onCancel}>
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-11 rounded-xl border-[var(--border)]" asChild>
              <Link to={cancelHref}>Cancelar</Link>
            </Button>
          )}
        </div>
      </form>
    </>
  )

  if (variant === "dialog") {
    return <div className="space-y-5">{formInner}</div>
  }

  return (
    <Card className="max-w-lg border-[var(--border)] bg-[var(--card)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-[var(--foreground)]">Alta de repositorio</CardTitle>
        <CardDescription className="text-[var(--foreground-muted)]">
          Configura un nuevo repositorio para sincronizar con el grafo. Selecciona la credencial y luego elige
          workspace, proyecto y branch.
        </CardDescription>
      </CardHeader>
      <CardContent>{formInner}</CardContent>
    </Card>
  )
}
