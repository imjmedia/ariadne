import { CHAT_PROMPT_TEMPLATES, type ChatPromptTemplate } from '@/utils/chat-prompt-templates';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatPromptChipsProps {
  onSelect: (template: ChatPromptTemplate) => void;
  disabled?: boolean;
  className?: string;
}

/** Quick prompts for architecture / reengineering / schema (multi-agent router). */
export function ChatPromptChips({ onSelect, disabled, className }: ChatPromptChipsProps) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {CHAT_PROMPT_TEMPLATES.map((t) => (
        <Button
          key={t.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-auto max-w-full whitespace-normal py-1 text-left text-xs font-normal"
          title={t.hint}
          onClick={() => onSelect(t)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
