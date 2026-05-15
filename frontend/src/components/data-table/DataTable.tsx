/**
 * @fileoverview Tabla con TanStack Table: ordenación y filtro global (Shadcn Table).
 */
import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Optional per-column layout classes (see RepoList column defs). */
export type DataTableColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  filterPlaceholder?: string;
  /** Clase del contenedor de la tabla (scroll horizontal). */
  tableClassName?: string;
};

function readColumnMeta<T>(columnDef: ColumnDef<T, unknown>): DataTableColumnMeta {
  const meta = columnDef.meta as DataTableColumnMeta | undefined;
  return meta ?? {};
}

export function DataTable<T>({ columns, data, filterPlaceholder = 'Filtrar…', tableClassName }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  });

  return (
    <div className="space-y-3">
      <Input
        value={globalFilter ?? ''}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder={filterPlaceholder}
        className="h-11 w-full max-w-2xl rounded-xl border-[var(--border)] bg-[var(--card)] text-sm shadow-sm placeholder:text-[var(--foreground-muted)]"
      />
      <div className={cn('min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)]/50', tableClassName)}>
        <Table className="w-max max-w-none">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-[var(--border)] hover:bg-transparent">
                {hg.headers.map((header) => {
                  const { headerClassName } = readColumnMeta(header.column.columnDef);
                  return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'h-auto min-h-0 whitespace-nowrap py-1.5 pl-2 pr-1 text-left align-middle text-[var(--foreground-muted)]',
                      headerClassName,
                    )}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-1 h-7 gap-0.5 whitespace-nowrap px-1.5 py-0 text-xs font-semibold hover:bg-[var(--secondary)]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="size-3 shrink-0 opacity-70" />
                        ) : header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="size-3 shrink-0 opacity-70" />
                        ) : (
                          <ArrowUpDown className="size-3 shrink-0 opacity-40" />
                        )}
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-[var(--border)]/80 transition-colors hover:bg-[var(--secondary)]/40">
                  {row.getVisibleCells().map((cell) => {
                    const { cellClassName } = readColumnMeta(cell.column.columnDef);
                    return (
                    <TableCell key={cell.id} className={cn('align-middle whitespace-nowrap px-2 py-1.5', cellClassName)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="whitespace-normal py-8 text-center text-sm text-[var(--foreground-muted)]">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
