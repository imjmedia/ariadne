/**
 * Campos opcionales de alcance para analyze (prefijos, globs, duplicados cross-boundary).
 */
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function AnalyzeScopeFields(props: {
  includePrefixesText: string;
  onIncludePrefixesText: (v: string) => void;
  excludeGlobsText: string;
  onExcludeGlobsText: (v: string) => void;
  crossPackageDuplicates: boolean;
  onCrossPackageDuplicates: (v: boolean) => void;
  showCrossPackage: boolean;
}) {
  const fieldClass = cn(
    'min-h-[4.25rem] resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs font-mono shadow-none',
    'placeholder:text-[var(--foreground-muted)]',
    'focus-visible:border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/15 focus-visible:ring-offset-0',
  );

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_8%,var(--card))] p-4 sm:p-5">
      <div className="flex flex-col gap-0.5 border-b border-[var(--border)]/80 pb-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">Alcance opcional</p>
        <p className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">
          Limita prefijos y exclusiones; se reutiliza en chat y análisis.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="analyze-include-prefixes" className="text-xs font-medium text-[var(--foreground-muted)]">
          Prefijos de ruta (uno por línea)
        </Label>
        <Textarea
          id="analyze-include-prefixes"
          value={props.includePrefixesText}
          onChange={(e) => props.onIncludePrefixesText(e.target.value)}
          rows={2}
          placeholder="p. ej. src/components"
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="analyze-exclude-globs" className="text-xs font-medium text-[var(--foreground-muted)]">
          Excluir (globs, uno por línea)
        </Label>
        <Textarea
          id="analyze-exclude-globs"
          value={props.excludeGlobsText}
          onChange={(e) => props.onExcludeGlobsText(e.target.value)}
          rows={2}
          placeholder="p. ej. **/*.spec.ts"
          className={fieldClass}
        />
      </div>
      {props.showCrossPackage ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--card)]/80 p-3 transition-colors hover:bg-[var(--card)]">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded border-[var(--border)] bg-[var(--card)] text-[var(--primary)] accent-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)]/15 focus-visible:ring-offset-0"
            checked={props.crossPackageDuplicates}
            onChange={(e) => props.onCrossPackageDuplicates(e.target.checked)}
          />
          <span className="text-xs leading-snug text-[var(--foreground-muted)]">
            Modo duplicados: incluir pares cross-boundary (un solo extremo en el foco)
          </span>
        </label>
      ) : null}
    </div>
  );
}
