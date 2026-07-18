import type { ChatAnalysisPanelProps } from './ChatAnalysisPanel';
import { ChatAnalysisPanel } from './ChatAnalysisPanel';

/** @deprecated Usar ChatAnalysisPanel inline; el drawer ya no se usa en chat. */
export function ChatAnalysisSheet(
  props: ChatAnalysisPanelProps & { open?: boolean; onOpenChange?: (open: boolean) => void },
) {
  if (props.open === false) return null;
  return <ChatAnalysisPanel {...props} />;
}

export { ChatAnalysisPanel };
