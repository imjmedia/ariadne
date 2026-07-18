import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RepoOption = { id: string; projectKey: string; repoSlug: string };

export function ChatProjectScopeOptions(props: {
  repositories: RepoOption[];
  selectedRepoId: string;
  onSelectedRepoIdChange: (id: string) => void;
  allowBroadProjectChat: boolean;
  onAllowBroadProjectChatChange: (v: boolean) => void;
}) {
  if (props.repositories.length <= 1) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_8%,var(--card))] p-3">
      {!props.allowBroadProjectChat ? (
        <div className="space-y-2">
          <Label htmlFor="project-chat-repo-focus" className="text-xs font-medium text-[var(--foreground-muted)]">
            Enfocar chat en repositorio
          </Label>
          <Select value={props.selectedRepoId} onValueChange={props.onSelectedRepoIdChange}>
            <SelectTrigger id="project-chat-repo-focus" size="sm" className="h-10 w-full rounded-xl font-mono text-xs">
              <SelectValue placeholder="Elegir repositorio" />
            </SelectTrigger>
            <SelectContent>
              {props.repositories.map((r) => (
                <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                  {r.projectKey}/{r.repoSlug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <label className="flex cursor-pointer items-start gap-3 text-xs">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
          checked={props.allowBroadProjectChat}
          onChange={(e) => props.onAllowBroadProjectChatChange(e.target.checked)}
        />
        <span className="leading-snug text-[var(--foreground-muted)]">
          <span className="font-medium text-[var(--foreground)]">Chat amplio</span> — consulta todos los repos del
          proyecto sin exigir alcance por repo.
        </span>
      </label>
    </div>
  );
}
