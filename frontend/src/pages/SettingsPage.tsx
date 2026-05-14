/**
 * Application settings shell — reserved for future preferences and org-wide options.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>
            Esta sección está en preparación. Aquí podrás ajustar preferencias de la aplicación cuando
            esté disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--foreground-muted)]">No hay opciones configurables todavía.</p>
        </CardContent>
      </Card>
    </div>
  );
}
