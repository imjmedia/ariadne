/**
 * Login / auth shell footer: license, repository links, collaborator avatars.
 */
import { Github, Scale } from 'lucide-react';
import {
  APACHE_LICENSE_URL,
  getGithubAvatarUrl,
  PRIMARY_AUTHOR,
  REPOSITORY_URL,
  SPECIAL_CONTRIBUTORS,
} from '@/constants/collaborators';

const currentYear = new Date().getFullYear();

export function LoginPageFooter() {
  const allForAvatars = [PRIMARY_AUTHOR, ...SPECIAL_CONTRIBUTORS];

  return (
    <footer className="mt-auto w-full border-t border-[var(--border)]/80 bg-[var(--background)]/90 px-4 py-6 backdrop-blur-sm sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 text-sm text-[var(--foreground-muted)]">
          <p>
            © {String(currentYear)} Ariadne / AriadneSpecs. Apache License 2.0.
            Código abierto en GitHub.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              <Github className="size-4 shrink-0" aria-hidden />
              Código en GitHub
            </a>
            <a
              href={APACHE_LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              <Scale className="size-4 shrink-0" aria-hidden />
              Licencia Apache 2.0
            </a>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
            Colaboradores y autores
          </p>
          <ul className="flex flex-wrap gap-0">
            {allForAvatars.map((c) => (
              <li key={c.githubUsername} className="-ml-2 first:ml-0">
                <a
                  href={`https://github.com/${c.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${c.name} (@${c.githubUsername})`}
                  className="relative block size-10 overflow-hidden rounded-full border-2 border-[var(--background)] bg-[var(--muted)] ring-2 ring-[var(--border)] transition-transform hover:z-10 hover:scale-105 hover:ring-[var(--primary)]/40"
                >
                  <img
                    src={getGithubAvatarUrl(c.githubUsername)}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
