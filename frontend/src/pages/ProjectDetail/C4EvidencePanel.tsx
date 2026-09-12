/**
 * @fileoverview Evidencias C4 con enlace al explorador de grafo.
 */
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { hrefGraphExplorer } from '@/lib/graphScope';

export type C4EvidenceItem = {
  source: string;
  nodeId?: string;
  filePath?: string;
  reason?: string;
};

export type C4EvidenceElement = {
  id: string;
  kind: string;
  name: string;
  evidence?: C4EvidenceItem[];
};

export function C4EvidencePanel({
  projectId,
  scopeKey,
  elements,
}: {
  projectId: string;
  scopeKey: string;
  elements: C4EvidenceElement[];
}) {
  if (elements.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Evidencias (clic → grafo)</p>
      <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
        {elements.map((el) => (
          <li key={el.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-medium">{el.name}</span>
              <Badge variant="outline" className="text-[10px]">{el.kind}</Badge>
            </div>
            {(el.evidence ?? []).map((ev, i) => (
              <div key={i} className="text-muted-foreground pl-2 border-l-2 border-[var(--border)]">
                <span className="font-mono text-[10px]">{ev.source}</span>
                {ev.reason ? ` — ${ev.reason}` : null}
                {el.kind === 'component' && ev.filePath ? (
                  <span className="block truncate">{ev.filePath}</span>
                ) : null}
                {el.kind === 'component' ? (
                  <Link
                    to={hrefGraphExplorer({
                      scopeKey,
                      graphProjectId: projectId,
                      componentName: el.name,
                      depth: '2',
                    })}
                    className="text-[var(--primary)] hover:underline"
                  >
                    Abrir en explorador
                  </Link>
                ) : null}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
