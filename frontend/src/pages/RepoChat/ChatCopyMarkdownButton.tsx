/**
 * Button to copy an assistant chat answer as raw Markdown (incl. ```mermaid fences).
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/utils/copy-text-to-clipboard';
import { buildChatMarkdownExport } from './chat-markdown-export.util';
import { cn } from '@/lib/utils';

export function ChatCopyMarkdownButton(props: {
  content: string;
  cypher?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    const markdown = buildChatMarkdownExport(props.content, props.cypher);
    if (!markdown.trim()) return;
    const ok = await copyTextToClipboard(markdown);
    if (ok) {
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2000);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]',
        props.className,
      )}
      onClick={() => void handleCopy()}
      aria-label="Copiar respuesta en Markdown"
      title={
        failed
          ? 'No se pudo copiar'
          : copied
            ? 'Copiado'
            : 'Copiar Markdown (incluye diagramas Mermaid)'
      }
    >
      {copied ? (
        <Check className="size-3.5 text-[var(--success)]" strokeWidth={2} aria-hidden />
      ) : (
        <Copy className="size-3.5" strokeWidth={2} aria-hidden />
      )}
      <span>{failed ? 'Error' : copied ? 'Copiado' : 'Markdown'}</span>
    </Button>
  );
}
