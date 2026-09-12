/**
 * @fileoverview Pestaña Arquitectura: dominio del proyecto y whitelist de dominios.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import type { Domain, Project, ProjectDomainDependency } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { C4DiagramViewer } from './C4DiagramViewer';
import { C4SequenceViewer } from './C4SequenceViewer';
import { cn } from '@/lib/utils';

export function ArchitecturePanel({
  project,
  projectId,
  onProjectUpdated,
}: {
  project: Project;
  projectId: string;
  onProjectUpdated: () => void;
}) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [deps, setDeps] = useState<ProjectDomainDependency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);
  const [addDomainId, setAddDomainId] = useState<string>('');
  const [connType, setConnType] = useState('REST');
  const [depDesc, setDepDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [archTab, setArchTab] = useState<'domains' | 'c4'>('domains');
  const [c4Level, setC4Level] = useState<'context' | 'container' | 'component'>('context');
  const [drillContainerKey, setDrillContainerKey] = useState<string | undefined>();

  const load = useCallback(() => {
    api
      .getDomains()
      .then(setDomains)
      .catch((e) => setError(e.message));
    api
      .listProjectDomainDependencies(projectId)
      .then(setDeps)
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProjectDomain = async (domainId: string | null) => {
    setSavingDomain(true);
    setError(null);
    try {
      await api.updateProject(projectId, { domainId });
      onProjectUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDomain(false);
    }
  };

  const addDep = async () => {
    if (!addDomainId) return;
    setAdding(true);
    setError(null);
    try {
      await api.addProjectDomainDependency(projectId, {
        dependsOnDomainId: addDomainId,
        connectionType: connType,
        description: depDesc.trim() || null,
      });
      setAddDomainId('');
      setDepDesc('');
      load();
      onProjectUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const removeDep = async (depId: string) => {
    try {
      await api.removeProjectDomainDependency(projectId, depId);
      load();
      onProjectUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const depChoices = domains.filter((d) => d.id !== project.domainId);

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <nav className="flex gap-2" aria-label="Secciones de arquitectura">
        <button
          type="button"
          onClick={() => setArchTab('domains')}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            archTab === 'domains'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
        >
          Dominios
        </button>
        <button
          type="button"
          onClick={() => setArchTab('c4')}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            archTab === 'c4'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
        >
          Diagramas C4
        </button>
      </nav>

      {archTab === 'c4' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagramas C4</CardTitle>
            <CardDescription>
              Context (dominios), Container (compose), Component (Falkor). Compara snapshots para ver delta de
              topología.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <nav className="flex gap-2" aria-label="Niveles C4">
              {(['context', 'container', 'component'] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => {
                    setC4Level(lv);
                    if (lv !== 'component') setDrillContainerKey(undefined);
                  }}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    c4Level === lv
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                >
                  {lv === 'context' ? 'Context' : lv === 'container' ? 'Container' : 'Component'}
                </button>
              ))}
            </nav>
            {c4Level === 'container' ? (
              <p className="text-xs text-muted-foreground">
                Tras generar Container, abre Component para drill-down por clave de servicio (ej.{' '}
                <button
                  type="button"
                  className="text-[var(--primary)] underline"
                  onClick={() => {
                    setDrillContainerKey('frontend');
                    setC4Level('component');
                  }}
                >
                  frontend
                </button>
                , ingest).
              </p>
            ) : null}
            <C4DiagramViewer
              projectId={projectId}
              level={c4Level}
              containerKey={drillContainerKey}
              scopeKey={`project:${projectId}`}
            />
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-sm font-medium mb-2">Secuencia API (Archify)</p>
              <C4SequenceViewer projectId={projectId} />
            </div>
            <div className="border-t border-[var(--border)] pt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void api.exportC4Markdown(projectId).then((bundle) => {
                    const blob = new Blob([bundle.merged], { type: 'text/markdown' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `c4-${projectId.slice(0, 8)}.md`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                }
              >
                Exportar documentación C4 (.md)
              </Button>
              <span className="text-xs text-muted-foreground self-center">
                Nivel code: usa explorador de grafo desde evidencias Component.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {archTab === 'domains' ? (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dominio del proyecto</CardTitle>
          <CardDescription>
            Asigna el proyecto a un dominio de gobierno. La whitelist enlaza otros dominios cuyos grafos se
            consideran en MCP (shards extendidos).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1 min-w-[220px]">
            <Label>Dominio</Label>
            <Select
              value={project.domainId ?? '__none__'}
              onValueChange={(v) => void saveProjectDomain(v === '__none__' ? null : v)}
              disabled={savingDomain || domains.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={domains.length === 0 ? 'Crea dominios primero' : 'Sin dominio'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(ninguno)</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded border"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="link" className="text-xs h-auto p-0" asChild>
            <Link to="/domains">Gestionar dominios</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dependencias entre dominios (whitelist)</CardTitle>
          <CardDescription>
            Define qué otros dominios puede consumir este proyecto (REST, gRPC, eventos…). Amplía la búsqueda en
            grafos Falkor de proyectos en esos dominios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 min-w-[200px]">
              <Label>Dominio destino</Label>
              <Select value={addDomainId || undefined} onValueChange={setAddDomainId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir dominio" />
                </SelectTrigger>
                <SelectContent>
                  {depChoices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-28">
              <Label>Tipo</Label>
              <Input value={connType} onChange={(e) => setConnType(e.target.value)} placeholder="REST" />
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label>Nota</Label>
              <Input value={depDesc} onChange={(e) => setDepDesc(e.target.value)} placeholder="Opcional" />
            </div>
            <Button type="button" disabled={!addDomainId || adding} onClick={() => void addDep()}>
              {adding ? 'Añadiendo…' : 'Añadir'}
            </Button>
          </div>

          {deps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin dependencias declaradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deps.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.dependsOnDomainName ?? d.dependsOnDomainId}</TableCell>
                    <TableCell className="font-mono text-xs">{d.connectionType}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.description ?? '—'}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" onClick={() => void removeDep(d.id)}>
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </>
      ) : null}
    </div>
  );
}
