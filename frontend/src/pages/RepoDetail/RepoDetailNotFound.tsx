import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RepoDetailBackNav } from './RepoDetailBackNav';
import { panelIntroClass, repoDetailPageClass } from './layoutClasses';

/** Repository id not found or invalid. */
export function RepoDetailNotFound() {
  return (
    <div className={repoDetailPageClass}>
      <RepoDetailBackNav />
      <div className={panelIntroClass}>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Repositorio</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
          No hay datos para mostrar en esta ruta.
        </p>
      </div>
      <Alert className="rounded-2xl border-[var(--border)] bg-[var(--card)]">
        <AlertTitle>No encontrado</AlertTitle>
        <AlertDescription>El repositorio no existe o ya no está disponible.</AlertDescription>
      </Alert>
    </div>
  );
}
