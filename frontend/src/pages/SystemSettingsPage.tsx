/**
 * Configuración global del sistema (admin): SMTP, CORS, Falkor, observabilidad y chat.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { api } from '@/api';
import type { SystemSettingsMasked, UpdateSystemSettingsDto } from '@/types';
import { getUser } from '@/utils/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { sectionHeaderClass, sectionShellClass } from './RepoDetail/layoutClasses';
import {
  settingsAlertClass,
  settingsCheckboxClass,
  settingsPageClass,
  settingsSectionBodyClass,
  settingsTabListClass,
  settingsTabPillClass,
  settingsToggleFieldClass,
} from './settingsUiClasses';

type SystemSettingsTabId = 'auth' | 'network' | 'observability';

const SYSTEM_SETTINGS_TABS: Array<{ id: SystemSettingsTabId; label: string }> = [
  { id: 'auth', label: 'Auth y correo' },
  { id: 'network', label: 'Red y Falkor' },
  { id: 'observability', label: 'Observabilidad' },
];

interface FormState {
  corsOrigin: string;
  emailOtp: string;
  ssoUrl: string;
  webAppHost: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpPassTouched: boolean;
  smtpFrom: string;
  falkorShardByProject: boolean;
  falkorShardByDomain: boolean;
  falkorAutoDomainOverflow: boolean;
  falkorGraphNodeSoftLimit: string;
  falkorDebugCypher: boolean;
  metricsEnabled: boolean;
  chatTelemetryLog: boolean;
  chatTwoPhase: boolean;
  modificationPlanMaxFiles: string;
}

function defaultForm(settings?: SystemSettingsMasked): FormState {
  return {
    corsOrigin: settings?.corsOrigin ?? '',
    emailOtp: settings?.emailOtp ?? '',
    ssoUrl: settings?.ssoUrl ?? '',
    webAppHost: settings?.webAppHost ?? '',
    smtpHost: settings?.smtp.host ?? '',
    smtpPort: String(settings?.smtp.port ?? 587),
    smtpUser: settings?.smtp.user ?? '',
    smtpPass: '',
    smtpPassTouched: false,
    smtpFrom: settings?.smtp.from ?? '',
    falkorShardByProject: settings?.falkor.shardByProject ?? false,
    falkorShardByDomain: settings?.falkor.shardByDomain ?? false,
    falkorAutoDomainOverflow: settings?.falkor.autoDomainOverflow ?? false,
    falkorGraphNodeSoftLimit: String(settings?.falkor.graphNodeSoftLimit ?? 100000),
    falkorDebugCypher: settings?.falkor.debugCypher ?? false,
    metricsEnabled: settings?.observability.metricsEnabled ?? true,
    chatTelemetryLog: settings?.observability.chatTelemetryLog ?? false,
    chatTwoPhase: settings?.chat.twoPhase ?? true,
    modificationPlanMaxFiles: String(settings?.chat.modificationPlanMaxFiles ?? 150),
  };
}

export function SystemSettingsPage() {
  const user = getUser();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<SystemSettingsTabId>('auth');
  const [settings, setSettings] = useState<SystemSettingsMasked | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.getSystemSettings();
      setSettings(cfg);
      setForm(defaultForm(cfg));
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: UpdateSystemSettingsDto = {
        corsOrigin: form.corsOrigin.trim() || null,
        emailOtp: form.emailOtp.trim() || null,
        ssoUrl: form.ssoUrl.trim() || null,
        webAppHost: form.webAppHost.trim() || null,
        smtpHost: form.smtpHost.trim() || null,
        smtpPort: parseInt(form.smtpPort, 10) || 587,
        smtpUser: form.smtpUser.trim() || null,
        smtpFrom: form.smtpFrom.trim() || null,
        falkorShardByProject: form.falkorShardByProject,
        falkorShardByDomain: form.falkorShardByDomain,
        falkorAutoDomainOverflow: form.falkorAutoDomainOverflow,
        falkorGraphNodeSoftLimit: parseInt(form.falkorGraphNodeSoftLimit, 10) || 100000,
        falkorDebugCypher: form.falkorDebugCypher,
        metricsEnabled: form.metricsEnabled,
        chatTelemetryLog: form.chatTelemetryLog,
        chatTwoPhase: form.chatTwoPhase,
        modificationPlanMaxFiles: parseInt(form.modificationPlanMaxFiles, 10) || 150,
      };
      if (form.smtpPassTouched) {
        payload.smtpPass = form.smtpPass.trim() ? form.smtpPass.trim() : null;
      }
      const saved = await api.updateSystemSettings(payload);
      setSettings(saved);
      setForm({ ...defaultForm(saved), smtpPass: '', smtpPassTouched: false });
      setSuccess('Configuración guardada. CORS y métricas pueden requerir reinicio de api/ingest.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const activeTabMeta = SYSTEM_SETTINGS_TABS.find((t) => t.id === activeTab)!;

  if (!isAdmin) {
    return (
      <div className={settingsPageClass}>
        <Alert variant="destructive">
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>Solo administradores pueden ver la configuración del sistema.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={settingsPageClass}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración del sistema</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Valores operativos con defaults en código. Solo quedan en <code className="text-xs">.env</code> las
            variables de bootstrap (Postgres, Redis, Falkor host, JWT, cifrado). GitHub y tokens de repo van en{' '}
            <Link to="/credentials" className="text-primary underline-offset-4 hover:underline">
              Credenciales
            </Link>
            .{' '}
            <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
              Ajustes IA
            </Link>
          </p>
        </div>
        <SlidersHorizontal className="hidden h-8 w-8 text-muted-foreground sm:block" aria-hidden />
      </header>

      {error && (
        <Alert variant="destructive" className={settingsAlertClass}>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className={settingsAlertClass}>
          <AlertTitle>Guardado</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <>
          <nav className={settingsTabListClass} aria-label="Secciones de configuración del sistema">
            {SYSTEM_SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={settingsTabPillClass(activeTab === tab.id)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className={`${sectionShellClass} mt-4`} role="tabpanel" aria-label={activeTabMeta.label}>
            <div className={sectionHeaderClass}>
              <h2 className="text-lg font-medium">{activeTabMeta.label}</h2>
            </div>

            {activeTab === 'auth' && (
              <div className={`${settingsSectionBodyClass} grid gap-4 md:grid-cols-2`}>
                <div className="space-y-2">
                  <Label htmlFor="emailOtp">Email OTP permitido</Label>
                  <Input id="emailOtp" value={form.emailOtp} onChange={(e) => setForm({ ...form, emailOtp: e.target.value })} placeholder="admin@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssoUrl">URL SSO (servidor)</Label>
                  <Input id="ssoUrl" value={form.ssoUrl} onChange={(e) => setForm({ ...form, ssoUrl: e.target.value })} placeholder="https://sso.example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP host</Label>
                  <Input id="smtpHost" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP puerto</Label>
                  <Input id="smtpPort" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP usuario</Label>
                  <Input id="smtpUser" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPass">SMTP contraseña {settings?.smtp.passHint ? `(actual: ${settings.smtp.passHint})` : ''}</Label>
                  <Input id="smtpPass" type="password" value={form.smtpPass} onChange={(e) => setForm({ ...form, smtpPass: e.target.value, smtpPassTouched: true })} placeholder={settings?.smtp.hasPass ? '••••••••' : ''} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="smtpFrom">Remitente (From)</Label>
                  <Input id="smtpFrom" value={form.smtpFrom} onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })} placeholder="Ariadne &lt;no-reply@empresa.com&gt;" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="webAppHost">Host app (magic link OTP)</Label>
                  <Input id="webAppHost" value={form.webAppHost} onChange={(e) => setForm({ ...form, webAppHost: e.target.value })} placeholder="ariadne.empresa.com" />
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className={`${settingsSectionBodyClass} grid gap-4 md:grid-cols-2`}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="corsOrigin">CORS origin (coma-separado)</Label>
                  <Input id="corsOrigin" value={form.corsOrigin} onChange={(e) => setForm({ ...form, corsOrigin: e.target.value })} placeholder="https://ariadne.empresa.com" />
                  <p className="text-xs text-muted-foreground">Reinicia api e ingest tras cambiar CORS.</p>
                </div>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.falkorShardByProject} onChange={(e) => setForm({ ...form, falkorShardByProject: e.target.checked })} />
                  Shard por proyecto
                </label>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.falkorShardByDomain} onChange={(e) => setForm({ ...form, falkorShardByDomain: e.target.checked })} />
                  Shard por dominio (ruta)
                </label>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.falkorAutoDomainOverflow} onChange={(e) => setForm({ ...form, falkorAutoDomainOverflow: e.target.checked })} />
                  Auto overflow por soft limit
                </label>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.falkorDebugCypher} onChange={(e) => setForm({ ...form, falkorDebugCypher: e.target.checked })} />
                  Debug Cypher (graph-explorer)
                </label>
                <div className="space-y-2">
                  <Label htmlFor="falkorLimit">Soft limit nodos/grafos</Label>
                  <Input id="falkorLimit" value={form.falkorGraphNodeSoftLimit} onChange={(e) => setForm({ ...form, falkorGraphNodeSoftLimit: e.target.value })} />
                </div>
              </div>
            )}

            {activeTab === 'observability' && (
              <div className={`${settingsSectionBodyClass} grid gap-4 md:grid-cols-2`}>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.metricsEnabled} onChange={(e) => setForm({ ...form, metricsEnabled: e.target.checked })} />
                  Métricas Prometheus
                </label>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.chatTelemetryLog} onChange={(e) => setForm({ ...form, chatTelemetryLog: e.target.checked })} />
                  Telemetría chat (logs)
                </label>
                <label className={settingsToggleFieldClass}>
                  <input type="checkbox" className={settingsCheckboxClass} checked={form.chatTwoPhase} onChange={(e) => setForm({ ...form, chatTwoPhase: e.target.checked })} />
                  Chat two-phase
                </label>
                <div className="space-y-2">
                  <Label htmlFor="modPlanMax">Modification plan max files</Label>
                  <Input id="modPlanMax" value={form.modificationPlanMaxFiles} onChange={(e) => setForm({ ...form, modificationPlanMaxFiles: e.target.value })} />
                </div>
              </div>
            )}
          </section>

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
              Descartar cambios
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
