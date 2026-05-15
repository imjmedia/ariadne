/**
 * Login shell footer — thin bar: legal line, subtle links, small collaborator avatars.
 */
import { Github, Scale } from 'lucide-react';
import {
  APACHE_LICENSE_URL,
  getCollaboratorRoleLabel,
  getGithubAvatarUrl,
  getGithubProfileUrl,
  PRIMARY_AUTHOR,
  REPOSITORY_URL,
  SPECIAL_CONTRIBUTORS,
  type Collaborator,
} from '@/constants/collaborators';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

const currentYear = new Date().getFullYear();

const AVATAR_SIZE = 22;

function CollaboratorAvatarHover({ collaborator }: { collaborator: Collaborator }) {
  const profileUrl = getGithubProfileUrl(collaborator.githubUsername);
  const roleLabel = getCollaboratorRoleLabel(collaborator.role);

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="relative block cursor-pointer overflow-hidden rounded-full border border-[var(--border)]/60 bg-[var(--muted)] outline-none transition-opacity hover:z-20 hover:opacity-100 hover:ring-1 hover:ring-[var(--ring)]/50 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          aria-label={`${collaborator.name}, ${roleLabel}`}
        >
          <img
            src={getGithubAvatarUrl(collaborator.githubUsername, 48)}
            alt=""
            className="size-full object-cover"
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            loading="lazy"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-[min(260px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-zinc-950 p-3 text-left shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {collaborator.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{roleLabel}</p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10 focus-visible:ring-white/40"
          >
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Perfil de GitHub de ${collaborator.name}`}
            >
              <Github className="size-5" aria-hidden />
            </a>
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function LoginPageFooter() {
  const allForAvatars = [PRIMARY_AUTHOR, ...SPECIAL_CONTRIBUTORS];

  return (
    <footer className="mt-auto w-full border-t border-[var(--border)]/30 bg-[var(--background)]/95 px-3 py-1.5 sm:px-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-[var(--foreground-muted)]/85 sm:text-xs">
          <span className="whitespace-nowrap">
            © {String(currentYear)} Ariadne · Apache-2.0
          </span>
          <span className="text-[var(--border)]" aria-hidden>
            ·
          </span>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 whitespace-nowrap transition-colors hover:text-[var(--foreground)]"
          >
            <Github className="size-3 shrink-0 opacity-70" aria-hidden />
            GitHub
          </a>
          <span className="text-[var(--border)]" aria-hidden>
            ·
          </span>
          <a
            href={APACHE_LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 whitespace-nowrap transition-colors hover:text-[var(--foreground)]"
          >
            <Scale className="size-3 shrink-0 opacity-70" aria-hidden />
            Licencia
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Colaboradores y autores</span>
          <ul className="flex items-center" aria-label="Colaboradores y autores">
            {allForAvatars.map((c) => (
              <li key={c.githubUsername} className="-ml-1 first:ml-0">
                <CollaboratorAvatarHover collaborator={c} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
