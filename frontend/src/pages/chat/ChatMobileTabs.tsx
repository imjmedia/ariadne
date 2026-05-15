/**
 * Segmented control: full-width chat vs tools on small viewports (lg+ both columns visible).
 */
import { chatMobileTabClass, chatMobileTablistClass } from './chatShellClasses';

export type ChatMobileTabId = 'chat' | 'tools';

export function ChatMobileTabs(props: {
  value: ChatMobileTabId;
  onChange: (next: ChatMobileTabId) => void;
  chatLabel?: string;
  toolsLabel?: string;
}) {
  const chatLabel = props.chatLabel ?? 'Conversación';
  const toolsLabel = props.toolsLabel ?? 'Análisis';

  return (
    <div
      role="tablist"
      aria-label="Vista del chat"
      className={chatMobileTablistClass}
    >
      <button
        type="button"
        role="tab"
        aria-selected={props.value === 'chat'}
        className={chatMobileTabClass(props.value === 'chat')}
        onClick={() => props.onChange('chat')}
      >
        {chatLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={props.value === 'tools'}
        className={chatMobileTabClass(props.value === 'tools')}
        onClick={() => props.onChange('tools')}
      >
        {toolsLabel}
      </button>
    </div>
  );
}
