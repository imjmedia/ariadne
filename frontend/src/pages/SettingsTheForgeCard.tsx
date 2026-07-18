import { useCallback, useEffect, useState } from 'react';
import { Hammer } from 'lucide-react';
import { api } from '@/api';
import type { TheForgeIntegrationSettings, UpdateTheForgeIntegrationDto } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { sectionHeaderClass, sectionShellClass } from './RepoDetail/layoutClasses';
import {
  settingsAlertClass,
  settingsCheckboxClass,
  settingsToggleFieldClass,
} from './settingsUiClasses';

interface ForgeFormState {
  enabled: boolean;
  apiUrl: string;
  serviceToken: string;
  serviceTokenTouched: boolean;
}

function defaultForgeForm(settings?: TheForgeIntegrationSettings): ForgeFormState {
  return {
    enabled: settings?.enabled ?? false,
    apiUrl: settings?.apiUrl ?? '',
    serviceToken: '',
    serviceTokenTouched: false,
  };
}

export function SettingsTheForgeCard() {
  const [settings, setSettings] = useState<TheForgeIntegrationSettings | null>(null);
  const [form, setForm] = useState<ForgeFormState>(() => defaultForgeForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.getTheForgeIntegrationSettings();
      setSettings(cfg);
      setForm(defaultForgeForm(cfg));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: UpdateTheForgeIntegrationDto = {
        enabled: form.enabled,
        apiUrl: form.apiUrl.trim() || null,
      };
      if (form.serviceTokenTouched) {
        payload.serviceToken = form.serviceToken.trim() ? form.serviceToken.trim() : null;
      }
      const saved = await api.updateTheForgeIntegrationSettings(payload);
      setSettings(saved);
      setForm({
        ...defaultForgeForm(saved),
        serviceToken: '',
        serviceTokenTouched: false,
      });
      setSuccess(
        saved.enabled
          ? 'Integración The Forge activada. El botón aparecerá en el chat.'
          : 'Integración The Forge desactivada.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={sectionShellClass} aria-busy="true" aria-label="Cargando integración The Forge">
        <div className={sectionHeaderClass}>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="space-y-4 px-5 py-6 sm:px-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl sm:max-w-xs" />
        </div>
      </section>
    );
  }

  return (
    <section className={sectionShellClass} aria-labelledby="theforge-settings-heading">
      <div className={sectionHeaderClass}>
        <h2
          id="theforge-settings-heading"
          className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]"
        >
          <Hammer className="size-5 shrink-0 text-[var(--foreground-muted)]" aria-hidden />
          The Forge (opcional)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
          Ariadne es open source y funciona sin The Forge. Activa esta integración solo si tienes The
          Forge desplegado y quieres promover conversaciones de chat a etapas de cambio (reingeniería,
          etc.). El brownfield converge por repo sigue configurándose en Editar repositorio.
        </p>
      </div>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        {error ? (
          <Alert variant="destructive" className={settingsAlertClass}>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert className={settingsAlertClass}>
            <AlertTitle>Guardado</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <label htmlFor="theforge-enabled" className={settingsToggleFieldClass}>
          <input
            id="theforge-enabled"
            type="checkbox"
            className={settingsCheckboxClass}
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          <span className="text-sm">
            <span className="font-medium">Habilitar integración The Forge</span>
            <span className="mt-1 block text-xs text-[var(--foreground-muted)]">
              Muestra el botón «The Forge» en el chat y permite promover hilos a etapas.
            </span>
          </span>
        </label>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theforge-api-url">URL API The Forge</Label>
            <Input
              id="theforge-api-url"
              value={form.apiUrl}
              onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
              placeholder="https://api.theforge.example"
              disabled={!form.enabled}
            />
            {settings?.envApiUrlConfigured ? (
              <p className="text-xs text-[var(--foreground-muted)]">
                Detectado <code className="text-xs">THEFORGE_API_URL</code> en el entorno como fallback al
                guardar.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="theforge-service-token">JWT de servicio (opcional)</Label>
            <Input
              id="theforge-service-token"
              type="password"
              value={form.serviceToken}
              onChange={(e) =>
                setForm({ ...form, serviceToken: e.target.value, serviceTokenTouched: true })
              }
              placeholder={
                settings?.hasServiceToken
                  ? `Configurado (${settings.serviceTokenHint ?? '••••'}) — dejar vacío para no cambiar`
                  : 'Bearer JWT servicio Ariadne ↔ The Forge'
              }
              disabled={!form.enabled}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:flex-wrap">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar The Forge'}
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
          Desarrollo: <code className="text-xs">THEFORGE_PROMOTE_MOCK=true</code> simula promoción sin
          API real.
        </p>
      </div>
    </section>
  );
}
