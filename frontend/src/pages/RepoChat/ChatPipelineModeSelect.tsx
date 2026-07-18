/**
 * Modo de pipeline para POST /chat: default | evidence_first (MDD) | raw_evidence + deterministicRetriever.
 */
import type { ChatPipelineMode } from '@/types';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OPTIONS: { value: ChatPipelineMode; label: string; hint: string }[] = [
  {
    value: 'default',
    label: 'Chat normal',
    hint: 'Prosa; ReAct en retrieve (hasta 4 vueltas LLM en backend).',
  },
  {
    value: 'evidence_first',
    label: 'MDD / SDD (recomendado)',
    hint: 'Una petición: JSON MDD 7 secciones desde Ariadne (menos idas y vueltas que varios MCP).',
  },
  {
    value: 'raw_evidence_fast',
    label: 'Evidencia bruta (barato)',
    hint: 'Sin LLM en retrieve; JSON para sintetizar fuera o depurar 429.',
  },
];

export function ChatPipelineModeSelect({
  value,
  onChange,
  id,
  density = 'compact',
}: {
  value: ChatPipelineMode;
  onChange: (v: ChatPipelineMode) => void;
  id?: string;
  /** `compact` = select + hint (menos altura). `comfortable` = radios con descripción inline. */
  density?: 'compact' | 'comfortable';
}) {
  const baseId = id ?? 'chat-pipeline-mode';
  const active = OPTIONS.find((o) => o.value === value);

  if (density === 'compact') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-trigger`} className="text-xs font-medium text-[var(--foreground-muted)]">
          Modo de respuesta
        </Label>
        <Select value={value} onValueChange={(v) => onChange(v as ChatPipelineMode)}>
          <SelectTrigger
            id={`${baseId}-trigger`}
            size="sm"
            className="h-10 w-full max-w-full rounded-xl border-[var(--border)] bg-[var(--card)] font-normal"
          >
            <SelectValue placeholder="Modo" />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active ? (
          <p id={`${baseId}-hint`} className="text-[11px] leading-relaxed text-[var(--foreground-muted)]">
            {active.hint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <fieldset
      className={cn(
        'space-y-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_12%,var(--card))] p-4 text-xs',
      )}
    >
      <legend className="px-0.5 text-sm font-semibold text-[var(--foreground)]">Modo de respuesta</legend>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent p-2 transition-colors hover:bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]"
          >
            <input
              type="radio"
              name={baseId}
              className="mt-1 size-4 shrink-0 border-[var(--border)] text-[var(--primary)]"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="min-w-0">
              <span className="font-medium text-[var(--foreground)]">{opt.label}</span>
              <span className="mt-0.5 block leading-relaxed text-[var(--foreground-muted)]">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
