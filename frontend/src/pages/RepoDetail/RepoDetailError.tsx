import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RepoDetailBackNav } from './RepoDetailBackNav';
import { panelIntroClass, repoDetailPageClass } from './layoutClasses';

interface RepoDetailErrorProps {
  error: string;
}

/** Load error with back navigation. */
export function RepoDetailError({ error }: RepoDetailErrorProps) {
  return (
    <div className={repoDetailPageClass}>
      <RepoDetailBackNav />
      <div className={panelIntroClass}>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Repositorio</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
          No se pudo cargar el detalle del repositorio.
        </p>
      </div>
      <Alert variant="destructive" className="rounded-2xl">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </div>
  );
}
