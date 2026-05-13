/**
 * Página de error. Lee message de query y permite volver al login.
 */
import { useSearchParams, Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

/** Página de error: muestra message de query y enlace al login. */
export function ErrorPage() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message') || 'Ha ocurrido un error.';

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[var(--background)] px-4">
      <ThemeToggle className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-50 sm:right-4" />
      <h2 className="text-destructive text-xl font-semibold">Error</h2>
      <p className="text-muted-foreground max-w-md text-center">{message}</p>
      <Button asChild variant="default">
        <Link to="/login">Volver al login</Link>
      </Button>
    </div>
  );
}
