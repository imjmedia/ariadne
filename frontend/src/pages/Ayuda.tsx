/**
 * @fileoverview Ayuda in-app: MCP, Skills y Manual. Layout con navegación lateral (desktop) y pestañas horizontales (móvil).
 */
import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Cpu, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocViewer, type DocViewerDoc, type ManualSlug } from '@/components/DocViewer';
import { cn } from '@/lib/utils';

const sections = [
  { to: '/ayuda/mcp', label: 'MCP', title: 'Ayuda — MCP FalkorSpecs', description: 'Herramientas del servidor MCP y buenas prácticas.', icon: Cpu },
  { to: '/ayuda/skills', label: 'Skills', title: 'Skill FalkorSpecs MCP', description: 'Uso del skill en el IDE y parámetros.', icon: Sparkles },
  { to: '/ayuda/manual', label: 'Manual', title: 'Manual de uso', description: 'Guías de arquitectura, ingestión, chat y más.', icon: BookOpen },
] as const;

const MANUAL_SLUGS: ManualSlug[] = [
  'configuracion',
  'indice',
  'architecture',
  'bitbucket',
  'db-schema',
  'indexing',
  'ingestion',
  'chat',
  'mcp-instalacion',
  'parse-refactor',
];

const panelIntroClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const navShellClass = cn(
  'rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm',
);

const contentShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

function getDocFromPath(pathname: string): { doc: DocViewerDoc; manualSlug?: ManualSlug | null } {
  if (pathname.includes('/manual/')) {
    const slug = pathname.split('/manual/')[1]?.split('/')[0] ?? '';
    return {
      doc: 'manual',
      manualSlug: MANUAL_SLUGS.includes(slug as ManualSlug) ? (slug as ManualSlug) : null,
    };
  }
  if (pathname.endsWith('/manual')) return { doc: 'manual' };
  if (pathname.endsWith('/skills')) return { doc: 'skills' };
  return { doc: 'mcp' };
}

function getSectionTitle(doc: DocViewerDoc, manualSlug?: ManualSlug | null): string {
  if (doc !== 'manual' || !manualSlug) {
    return sections.find((s) => s.to === `/ayuda/${doc}`)?.title ?? 'Ayuda';
  }
  const titles: Record<ManualSlug, string> = {
    configuracion: 'Configuración y Uso',
    indice: 'Índice de Documentación',
    architecture: 'Arquitectura',
    bitbucket: 'Webhook Bitbucket',
    'db-schema': 'Esquema del Grafo',
    indexing: 'Motor de Indexación',
    ingestion: 'Flujo de Ingesta',
    chat: 'Chat y Análisis',
    'mcp-instalacion': 'Instalación MCP en Cursor',
    'parse-refactor': 'Parse progresivo: archivos grandes',
  };
  return titles[manualSlug] ?? 'Manual';
}

function isSectionActive(pathname: string, to: string): boolean {
  if (to === '/ayuda/manual') return pathname.startsWith('/ayuda/manual');
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Ayuda() {
  const location = useLocation();
  const navigate = useNavigate();
  const { doc, manualSlug } = getDocFromPath(location.pathname);
  const title = getSectionTitle(doc, manualSlug);

  useEffect(() => {
    if (location.pathname === '/ayuda' || location.pathname === '/ayuda/') {
      navigate('/ayuda/mcp', { replace: true });
    }
  }, [location.pathname, navigate]);

  const activeSection = sections.find((s) => isSectionActive(location.pathname, s.to)) ?? sections[0];

  return (
    <div className="space-y-6 pb-8">
      <div className={panelIntroClass}>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Ayuda</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Documentación integrada: servidor MCP, skills de Cursor y manual técnico. Elige una sección; en el manual
          puedes navegar entre capítulos con los enlaces del documento.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        <nav
          className={cn(
            'flex gap-2 overflow-x-auto pb-1 lg:hidden',
            'snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
          aria-label="Secciones de ayuda"
        >
          {sections.map(({ to, label, icon: Icon }) => {
            const active = isSectionActive(location.pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex shrink-0 snap-start items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_38%,var(--card))] text-[var(--foreground)] shadow-sm'
                    : 'border-transparent bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))] text-[var(--foreground-muted)] hover:border-[var(--border)] hover:text-[var(--foreground)]',
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <aside className="relative hidden w-56 shrink-0 lg:block">
          <div
            className={cn(
              navShellClass,
              'lg:sticky lg:top-6 lg:z-10 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto',
            )}
          >
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              Secciones
            </p>
            <ul className="space-y-0.5">
              {sections.map(({ to, label, description, icon: Icon }) => {
                const active = isSectionActive(location.pathname, to);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))] text-[var(--foreground)] shadow-sm'
                          : 'text-[var(--foreground-muted)] hover:bg-[color-mix(in_oklch,var(--muted)_25%,transparent)] hover:text-[var(--foreground)]',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                        {label}
                      </span>
                      <span className="line-clamp-2 pl-6 text-[11px] leading-snug text-[var(--foreground-muted)]">
                        {description}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className={contentShellClass}>
            <header
              className={cn(
                'border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
                'px-5 py-4 sm:px-6 sm:py-5',
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground-muted)]">
                <Link to="/ayuda/mcp" className="font-medium hover:text-[var(--foreground)]">
                  Ayuda
                </Link>
                <span aria-hidden className="text-[var(--foreground-subtle)]">
                  /
                </span>
                <span className="font-medium text-[var(--foreground)]">{activeSection.label}</span>
                {manualSlug ? (
                  <>
                    <span aria-hidden className="text-[var(--foreground-subtle)]">
                      /
                    </span>
                    <span className="truncate text-[var(--foreground)]">{getSectionTitle('manual', manualSlug)}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                {manualSlug ? (
                  <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-lg border-[var(--border)]" asChild>
                    <Link to="/ayuda/manual">
                      <ArrowLeft className="size-4" aria-hidden />
                      Manual principal
                    </Link>
                  </Button>
                ) : null}
                <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
                  {title}
                </h2>
              </div>
            </header>
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <DocViewer doc={doc} manualSlug={manualSlug} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
