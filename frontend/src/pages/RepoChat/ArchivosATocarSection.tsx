import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ArchivoATocarRow } from './chat-archivos-section.util';
import { parseArchivosATocarSection } from './chat-archivos-section.util';

function ArchivosATocarTable(props: { rows: ArchivoATocarRow[] }) {
  const showRepo = props.rows.some((r) => Boolean(r.repoId?.trim()));
  const showSimbolo = props.rows.some((r) => Boolean(r.simbolo?.trim()));

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 whitespace-nowrap">Archivo</TableHead>
            {showRepo ? <TableHead className="h-8 whitespace-nowrap">Repo</TableHead> : null}
            <TableHead className="h-8 min-w-[10rem]">Qué tocar/modificar</TableHead>
            {showSimbolo ? <TableHead className="h-8 whitespace-nowrap">Símbolo</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row, i) => (
            <TableRow key={`${row.path}-${row.repoId ?? ''}-${i}`}>
              <TableCell className="font-mono text-[11px] leading-snug">{row.path}</TableCell>
              {showRepo ? (
                <TableCell className="max-w-[8rem] truncate font-mono text-[10px] text-[var(--foreground-muted)]">
                  {row.repoId ?? '—'}
                </TableCell>
              ) : null}
              <TableCell className="text-[11px] leading-snug">
                {row.queTocar?.trim() || '—'}
              </TableCell>
              {showSimbolo ? (
                <TableCell className="font-mono text-[11px]">{row.simbolo ?? '—'}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ArchivosATocarSection(props: {
  title: string;
  body: string;
  renderPreamble?: (preamble: string) => ReactNode;
}) {
  const { rows, preamble } = parseArchivosATocarSection(props.body);

  return (
    <details
      className={cn(
        'group my-2 rounded-lg border border-[var(--border)]',
        'bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))]',
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2',
          'text-[11px] font-medium text-[var(--foreground-muted)]',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span className="text-[var(--foreground)]">
          {props.title}
          {rows.length > 0 ? (
            <span className="ml-1.5 font-normal text-[var(--foreground-muted)]">
              ({rows.length} archivo{rows.length === 1 ? '' : 's'})
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-2 border-t border-[var(--border)] px-2.5 py-2">
        {preamble && props.renderPreamble ? props.renderPreamble(preamble) : null}
        {rows.length > 0 ? (
          <ArchivosATocarTable rows={rows} />
        ) : props.renderPreamble ? (
          props.renderPreamble(props.body || '_Sin detalle._')
        ) : null}
      </div>
    </details>
  );
}
