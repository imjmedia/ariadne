/**
 * @fileoverview Lista de credenciales (GET /credentials), alta en modal (?create=1) y edición por ruta.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KeyRound, Plus } from 'lucide-react';
import { api } from '@/api';
import type { Credential } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateCredentialForm } from '@/pages/CreateCredentialForm';
import { cn } from '@/lib/utils';

const panelIntroClass = cn(
  'rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const listShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm',
  'transition-shadow duration-[var(--transition-base)] hover:shadow-md',
);

const listToolbarClass = cn(
  'flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]',
  'bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] px-4 py-3 sm:px-5',
);

export function CredentialsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createOpen = searchParams.get('create') === '1';

  const setCreateOpen = useCallback(
    (open: boolean) => {
      const next = new URLSearchParams(searchParams);
      if (open) next.set('create', '1');
      else next.delete('create');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMountKey, setFormMountKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    void api
      .getCredentials()
      .then(setCreds)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    setFormMountKey((k) => k + 1);
  }, [createOpen]);

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true);
  }, [setCreateOpen]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setCreateOpen(open);
    },
    [setCreateOpen],
  );

  const handleCreated = useCallback(() => {
    setCreateOpen(false);
    load();
  }, [load, setCreateOpen]);

  const countLabel = useMemo(() => {
    const n = creds.length;
    return `${n} credencial${n !== 1 ? 'es' : ''}`;
  }, [creds.length]);

  /** Elimina credencial con DELETE /credentials/:id tras confirmar; recarga la lista. */
  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar esta credencial?')) return;
    void api
      .deleteCredential(id)
      .then(load)
      .catch((e: Error) => setError(e.message));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className={panelIntroClass}>
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        </div>
        <div className={listShellClass}>
          <div className={listToolbarClass}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
          <div className="p-5 sm:p-6">
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() => {
            setError(null);
            load();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={panelIntroClass}>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Credenciales</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          Tokens y secrets cifrados en base de datos. Se asignan a repositorios con{' '}
          <span className="font-mono text-xs text-[var(--foreground)]">credentialsRef</span> para descubrir
          workspaces, repos y ramas sin exponer el valor en el cliente.
        </p>
      </div>

      <div className={listShellClass}>
        <div className={listToolbarClass}>
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Listado</h2>
            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{countLabel}</p>
          </div>
          <Button type="button" className="h-11 shrink-0 gap-2 rounded-xl px-4" onClick={handleOpenCreate}>
            <Plus className="size-4" aria-hidden />
            Nueva credencial
          </Button>
        </div>

        <div className="p-5 sm:p-6">
          {creds.length === 0 ? (
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)]',
                'bg-[color-mix(in_oklch,var(--muted)_42%,transparent)] px-6 py-14 text-center',
              )}
            >
              <div
                className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
                aria-hidden
              >
                <KeyRound className="size-7 text-[var(--foreground-muted)]" />
              </div>
              <p className="m-0 text-sm font-medium text-[var(--foreground)]">Aún no hay credenciales</p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--foreground-muted)]">
                Crea una para conectar Bitbucket o GitHub al indexar repos. El secreto se guarda cifrado; aquí solo verás
                proveedor, tipo y nombre opcional.
              </p>
              <Button type="button" className="mt-6 h-11 gap-2 rounded-xl px-5" onClick={handleOpenCreate}>
                <Plus className="size-4" aria-hidden />
                Crear credencial
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] hover:bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]">
                    <TableHead className="text-xs font-medium text-[var(--foreground-muted)]">Provider</TableHead>
                    <TableHead className="text-xs font-medium text-[var(--foreground-muted)]">Tipo</TableHead>
                    <TableHead className="text-xs font-medium text-[var(--foreground-muted)]">Nombre</TableHead>
                    <TableHead className="text-xs font-medium text-[var(--foreground-muted)]">Creado</TableHead>
                    <TableHead className="w-[200px] text-right text-xs font-medium text-[var(--foreground-muted)]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creds.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.provider}</TableCell>
                      <TableCell>{c.kind}</TableCell>
                      <TableCell className="text-[var(--foreground-muted)]">{c.name ?? '—'}</TableCell>
                      <TableCell className="text-xs text-[var(--foreground-muted)]">
                        {new Date(c.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" className="h-9 rounded-lg px-3 text-xs" asChild>
                            <Link to={`/credentials/${c.id}/edit`}>Editar</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="h-9 rounded-lg px-3 text-xs"
                            onClick={() => handleDelete(c.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            'flex max-h-[min(94vh,920px)] w-[calc(100%-1.5rem)] max-w-[min(100vw-1.5rem,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl',
            'border-[var(--border)] bg-[var(--card)]',
          )}
        >
          <div
            className={cn(
              'shrink-0 border-b border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_26%,var(--card))]',
              'px-6 py-5 pr-14 sm:px-8 sm:py-6 sm:pr-16',
            )}
          >
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Nueva credencial</DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)] sm:text-[15px]">
                Almacena un token o secret cifrado. Tras crearla podrás elegirla al dar de alta o editar un repositorio.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 sm:px-8 sm:pb-8">
            <CreateCredentialForm
              key={formMountKey}
              onSuccess={handleCreated}
              onCancel={() => setCreateOpen(false)}
              className="min-h-0"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
