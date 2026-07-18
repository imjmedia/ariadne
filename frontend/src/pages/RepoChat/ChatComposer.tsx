import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const composerTextareaClass = cn(
  'min-h-[3.25rem] max-h-40 flex-1 resize-none rounded-xl border-0 bg-transparent text-sm shadow-none',
  'placeholder:text-[var(--foreground-muted)]',
  'focus-visible:outline-none focus-visible:ring-0',
);

export function ChatComposer(props: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  loading: boolean;
  placeholder?: string;
}) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_6%,var(--card))] px-3 py-3 sm:px-4">
      <div className="mx-auto flex max-w-[44rem] flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          value={props.input}
          onChange={(e) => props.onInputChange(e.target.value)}
          onKeyDown={props.onKeyDown}
          placeholder={props.placeholder ?? 'Escribe tu pregunta…'}
          rows={2}
          disabled={props.loading}
          className={composerTextareaClass}
          aria-label="Mensaje al chat"
          title="Enter envía · Mayús+Enter nueva línea"
        />
        <Button
          type="button"
          onClick={props.onSend}
          disabled={props.loading || !props.input.trim()}
          className="h-11 w-full shrink-0 gap-2 rounded-xl touch-manipulation sm:w-auto sm:min-w-[7rem]"
        >
          <Send className="size-4 shrink-0" aria-hidden />
          Enviar
        </Button>
      </div>
    </div>
  );
}
