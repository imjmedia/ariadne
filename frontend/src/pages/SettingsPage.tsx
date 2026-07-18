/**
 * Global LLM settings (admin): provider catalog, API key, models, embeddings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { api } from '@/api';
import type {
  LlmProviderCatalogEntry,
  LlmProviderId,
  LlmSettingsMasked,
  LlmTestConnectionResult,
} from '@/types';
import { getUser } from '@/utils/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SettingsTheForgeCard } from './SettingsTheForgeCard';

interface FormState {
  provider: LlmProviderId;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  orchestratorChatModel: string;
  orchestratorRouterModel: string;
  orchestratorWorkerModel: string;
  chatIntentRouterEnabled: boolean;
  temperature: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: string;
  accountId: string;
  httpReferer: string;
  appTitle: string;
}

function defaultForm(catalog: LlmProviderCatalogEntry[], settings?: LlmSettingsMasked): FormState {
  const provider = settings?.provider ?? catalog[0]?.id ?? 'openrouter';
  const entry = catalog.find((c) => c.id === provider) ?? catalog[0];
  const extras = settings?.extras ?? {};
  return {
    provider,
    apiKey: '',
    baseUrl: settings?.baseUrl ?? entry?.defaultBaseUrl ?? '',
    chatModel: settings?.chatModel ?? entry?.defaultChatModel ?? '',
    orchestratorChatModel: settings?.orchestratorChatModel ?? '',
    orchestratorRouterModel: settings?.orchestratorRouterModel ?? '',
    orchestratorWorkerModel: settings?.orchestratorWorkerModel ?? '',
    chatIntentRouterEnabled: settings?.chatIntentRouterEnabled ?? true,
    temperature: String(settings?.temperature ?? 0.1),
    embeddingProvider: settings?.embeddingProvider ?? provider,
    embeddingModel: settings?.embeddingModel ?? entry?.defaultEmbeddingModel ?? '',
    embeddingDimension: String(
      settings?.embeddingDimension ?? entry?.defaultEmbeddingDimension ?? 1536,
    ),
    accountId: typeof extras.accountId === 'string' ? extras.accountId : '',
    httpReferer: settings?.httpReferer ?? '',
    appTitle: settings?.appTitle ?? 'Ariadne',
  };
}

export function SettingsPage() {
  const user = getUser();
  const isAdmin = user?.role === 'admin';

  const [catalog, setCatalog] = useState<LlmProviderCatalogEntry[]>([]);
  const [settings, setSettings] = useState<LlmSettingsMasked | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<LlmTestConnectionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, cfg] = await Promise.all([api.getLlmCatalog(), api.getLlmSettings()]);
      setCatalog(cat);
      setSettings(cfg);
      setForm(defaultForm(cat, cfg));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  const selectedCatalog = useMemo(
    () => catalog.find((c) => c.id === form?.provider),
    [catalog, form?.provider],
  );

  const handleProviderChange = (provider: LlmProviderId) => {
    const entry = catalog.find((c) => c.id === provider);
    if (!entry || !form) return;
    setForm({
      ...form,
      provider,
      baseUrl: entry.defaultBaseUrl,
      chatModel: entry.defaultChatModel,
      embeddingProvider: entry.supportsEmbeddings ? provider : '',
      embeddingModel: entry.defaultEmbeddingModel ?? '',
      embeddingDimension: String(entry.defaultEmbeddingDimension ?? 1536),
    });
  };

  const buildDto = () => {
    if (!form) return {};
    const extras: Record<string, unknown> = { ...(settings?.extras ?? {}) };
    if (form.provider === 'cloudflare' && form.accountId.trim()) {
      extras.accountId = form.accountId.trim();
    }
    return {
      provider: form.provider,
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      baseUrl: form.baseUrl.trim() || undefined,
      chatModel: form.chatModel.trim() || undefined,
      orchestratorChatModel: form.orchestratorChatModel.trim() || null,
      orchestratorRouterModel: form.orchestratorRouterModel.trim() || null,
      orchestratorWorkerModel: form.orchestratorWorkerModel.trim() || null,
      chatIntentRouterEnabled: form.chatIntentRouterEnabled,
      temperature: parseFloat(form.temperature) || 0.1,
      embeddingProvider: (form.embeddingProvider || null) as LlmProviderId | null,
      embeddingModel: form.embeddingModel.trim() || null,
      embeddingDimension: parseInt(form.embeddingDimension, 10) || 1536,
      extras,
      httpReferer: form.httpReferer.trim() || null,
      appTitle: form.appTitle.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);
    try {
      const updated = await api.updateLlmSettings(buildDto());
      setSettings(updated);
      setForm((f) => (f ? { ...f, apiKey: '' } : f));
      setSuccess('Configuración guardada. Ingest y orchestrator la aplican de inmediato.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await api.testLlmSettings(buildDto());
      setTestResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Alert>
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            Solo los administradores pueden gestionar la configuración LLM del despliegue.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cargando ajustes…</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-[var(--primary)]" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Configuración global del proveedor LLM para chat, análisis y embeddings.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertTitle>Guardado</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {testResult && (
        <Alert variant={testResult.ok ? 'default' : 'destructive'}>
          <AlertTitle>{testResult.ok ? 'Conexión OK' : 'Conexión fallida'}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap break-words text-xs">
            {testResult.message}
            {testResult.model ? `\nModelo: ${testResult.model}` : ''}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Proveedor de IA</CardTitle>
          <CardDescription>
            Fuente actual: <strong>{settings?.source === 'db' ? 'Ajustes (BD)' : 'Variables de entorno'}</strong>
            {settings?.apiKeyHint ? ` · Clave: ${settings.apiKeyHint}` : settings?.hasApiKey ? '' : ' · Sin API key'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="provider">Proveedor</Label>
            <Select value={form.provider} onValueChange={(v) => handleProviderChange(v as LlmProviderId)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Selecciona proveedor" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCatalog?.apiKeyHelpUrl && (
              <p className="text-xs text-[var(--foreground-muted)]">
                <a
                  href={selectedCatalog.apiKeyHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Obtener clave API
                </a>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              Clave API {settings?.apiKeyHint ? `(actual: ${settings.apiKeyHint})` : ''}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="Dejar vacío para no cambiar"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]"
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {form.provider === 'cloudflare' && (
            <div className="space-y-2">
              <Label htmlFor="accountId">Account ID (Cloudflare)</Label>
              <Input
                id="accountId"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                placeholder="Cloudflare account ID"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="baseUrl">URL base</Label>
            <Input
              id="baseUrl"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              disabled={!selectedCatalog?.baseUrlEditable && form.provider !== 'cloudflare'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chatModel">Modelo de chat (ingest)</Label>
              <Input
                id="chatModel"
                value={form.chatModel}
                onChange={(e) => setForm({ ...form, chatModel: e.target.value })}
                list="chat-models"
              />
              <datalist id="chat-models">
                {selectedCatalog?.chatModels?.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="orchModel">Modelo orchestrator (opcional)</Label>
              <Input
                id="orchModel"
                value={form.orchestratorChatModel}
                onChange={(e) => setForm({ ...form, orchestratorChatModel: e.target.value })}
                placeholder="Vacío = mismo que ingest"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
            <div>
              <p className="text-sm font-medium">Chat multi-agente</p>
              <p className="text-xs text-[var(--foreground-muted)]">
                Router (intención + auditoría de reingeniería) y worker (retrieve + síntesis). Vacío =
                mismo que modelo orchestrator.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="routerModel">Modelo router (razonamiento)</Label>
                <Input
                  id="routerModel"
                  value={form.orchestratorRouterModel}
                  onChange={(e) => setForm({ ...form, orchestratorRouterModel: e.target.value })}
                  placeholder="ej. anthropic/claude-sonnet-4"
                  list="chat-models"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workerModel">Modelo worker (económico)</Label>
                <Input
                  id="workerModel"
                  value={form.orchestratorWorkerModel}
                  onChange={(e) => setForm({ ...form, orchestratorWorkerModel: e.target.value })}
                  placeholder="ej. google/gemini-2.0-flash-001"
                  list="chat-models"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.chatIntentRouterEnabled}
                onChange={(e) =>
                  setForm({ ...form, chatIntentRouterEnabled: e.target.checked })
                }
              />
              <span>
                Router de intención con LLM
                <span className="mt-0.5 block text-xs text-[var(--foreground-muted)]">
                  Desactivado: solo heurística por keywords (más rápido, menos preciso).
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">Temperatura</Label>
            <Input
              id="temperature"
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            />
          </div>

          {selectedCatalog?.supportsEmbeddings && (
            <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
              <p className="text-sm font-medium">Embeddings (RAG)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="embeddingModel">Modelo de embeddings</Label>
                  <Input
                    id="embeddingModel"
                    value={form.embeddingModel}
                    onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })}
                    list="embed-models"
                  />
                  <datalist id="embed-models">
                    {selectedCatalog.embeddingModels?.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="embeddingDim">Dimensión</Label>
                  <Input
                    id="embeddingDim"
                    type="number"
                    value={form.embeddingDimension}
                    onChange={(e) => setForm({ ...form, embeddingDimension: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="httpReferer">HTTP Referer (OpenRouter)</Label>
              <Input
                id="httpReferer"
                value={form.httpReferer}
                onChange={(e) => setForm({ ...form, httpReferer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appTitle">App title (OpenRouter)</Label>
              <Input
                id="appTitle"
                value={form.appTitle}
                onChange={(e) => setForm({ ...form, appTitle: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" onClick={() => void handleSave()} disabled={saving || testing}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleTest()}
              disabled={saving || testing}
            >
              {testing ? 'Probando…' : 'Probar conexión'}
            </Button>
          </div>

          <p className="text-xs text-[var(--foreground-muted)]">
            Las variables <code className="text-xs">LLM_*</code> en el entorno siguen como fallback si no
            hay fila guardada en BD. Tras guardar aquí, Ajustes tiene prioridad.
          </p>
        </CardContent>
      </Card>

      <SettingsTheForgeCard />
    </div>
  );
}
