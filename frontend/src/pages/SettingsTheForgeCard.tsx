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
import { SettingsDetailsSection } from './SettingsDetailsSection';
import {
  settingsAlertClass,
  settingsCheckboxClass,
  settingsSectionBodyClass,
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
          ? 'Integración activada. Verás el botón en el chat.'
          : 'Integración desactivada.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={sectionShellClass} aria-busy="true" aria-label="Cargando The Forge">
        <div className={sectionHeaderClass}>
          <Skeleton className="h-6 w-40" />
        </div>
        <div className={settingsSectionBodyClass}>
          <Skeleton className="h-14 w-full rounded-xl" />
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
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          Solo si tienes The Forge desplegado. Ariadne funciona sin instalarlo.
        </p>
      </div>

      <div className={settingsSectionBodyClass}>
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
            <span className="font-medium">Habilitar integración</span>
            <span className="mt-1 block text-xs text-[var(--foreground-muted)]">
              Promover conversaciones de chat a etapas en The Forge.
            </span>
          </span>
        </label>

        {form.enabled ? (
          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <Label htmlFor="theforge-api-url">URL The Forge</Label>
              <Input
                id="theforge-api-url"
                value={form.apiUrl}
                onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                placeholder="https://tu-dominio/mcp o …/api"
              />
              <p className="text-xs text-[var(--foreground-muted)]">
                MCP Streamable HTTP (<code className="text-xs">…/mcp</code>) con Secret MCP o JWT de sesión,
                o REST Nest (<code className="text-xs">…/api</code>) con JWT de servicio.
              </p>
              {settings?.envApiUrlConfigured ? (
                <p className="text-xs text-[var(--foreground-muted)]">
                  Fallback: <code className="text-xs">THEFORGE_API_URL</code> en el entorno.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="theforge-service-token">Token / JWT</Label>
              <Input
                id="theforge-service-token"
                type="password"
                value={form.serviceToken}
                onChange={(e) =>
                  setForm({ ...form, serviceToken: e.target.value, serviceTokenTouched: true })
                }
                placeholder={
                  settings?.hasServiceToken
                    ? `Configurado (${settings.serviceTokenHint ?? '••••'})`
                    : 'Secret MCP, JWT sesión o JWT servicio REST'
                }
                autoComplete="off"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row">
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar The Forge'}
          </Button>
        </div>

        <SettingsDetailsSection id="theforge-dev" title="Notas para desarrollo" defaultOpen={false}>
          <p className="text-xs text-[var(--foreground-muted)]">
            <code className="text-xs">THEFORGE_PROMOTE_MOCK=true</code> simula promoción sin API real.
            Brownfield converge se configura por repo en Editar repositorio.
          </p>
        </SettingsDetailsSection>
      </div>
    </section>
  );
}
