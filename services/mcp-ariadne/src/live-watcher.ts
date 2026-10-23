#!/usr/bin/env node
/**
 * @fileoverview Ariadne Live Daemon (Cursor Workspace Watcher)
 *
 * Vigila los eventos de guardado y cambio de archivos en el workspace local de Cursor,
 * enviando deltas atómicos directos al grafo FalkorDB (vía Ingest) en milisegundos,
 * eliminando la necesidad de hacer commit y push a Bitbucket para refrescar el contexto.
 */

import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";

const WATCH_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".prisma",
]);

const IGNORED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".idea",
  ".vscode",
  "coverage",
];

const INGEST_URL = (
  process.env.INGEST_URL ??
  process.env.ARIADNESPEC_INGEST_URL ??
  "http://localhost:3002"
).replace(/\/$/, "");

const DEBOUNCE_MS = 300;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export interface LiveWatcherOptions {
  workspaceRoot?: string;
  projectId?: string;
  repoId?: string;
}

export function shouldIgnore(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return IGNORED_DIRS.some((d) => norm.includes(`/${d}/`) || norm.startsWith(`${d}/`));
}

export async function syncFileToAriadne(
  filePath: string,
  root: string,
  options: LiveWatcherOptions = {},
): Promise<void> {
  const relPath = relative(root, filePath).replace(/\\/g, "/");
  const ext = extname(filePath).toLowerCase();
  if (!WATCH_EXTENSIONS.has(ext) && !relPath.endsWith("package.json")) {
    return;
  }

  let content = "";
  let isDeleted = false;

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) return;
    content = await readFile(filePath, "utf-8");
  } catch {
    isDeleted = true;
    content = "";
  }

  const start = Date.now();
  try {
    const res = await fetch(`${INGEST_URL}/repositories/local-sync/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: relPath,
        content: isDeleted ? "" : content,
        projectId: options.projectId,
        repoId: options.repoId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Ariadne Live Daemon] ⚠️ Error ${res.status} sincronizando ${relPath}: ${errText}`);
      return;
    }

    const json = (await res.json()) as {
      status: string;
      path: string;
      componentsIndexed?: number;
      functionsIndexed?: number;
    };
    const elapsed = Date.now() - start;

    if (json.status === "deleted") {
      console.log(`[Ariadne Live Daemon] 🗑️  Eliminado del grafo: ${relPath} [${elapsed}ms]`);
    } else {
      console.log(
        `[Ariadne Live Daemon] ⚡ Sincronizado: ${relPath} (${json.componentsIndexed ?? 0} comps, ${json.functionsIndexed ?? 0} fns) [${elapsed}ms]`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Ariadne Live Daemon] ❌ Error conectando a ${INGEST_URL}: ${msg}`);
  }
}

export function startLiveWatcher(options: LiveWatcherOptions = {}): { close: () => void } {
  const root = resolve(options.workspaceRoot || process.cwd());
  console.log(`[Ariadne Live Daemon] 👁️  Vigilando cambios locales en: ${root}`);
  console.log(`[Ariadne Live Daemon] 🔗 Conectado a Ingest: ${INGEST_URL}`);

  const watcher = watch(root, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const fullPath = resolve(root, filename);
    if (shouldIgnore(filename)) return;

    const ext = extname(filename).toLowerCase();
    if (!WATCH_EXTENSIONS.has(ext) && !filename.endsWith("package.json")) return;

    const existing = debounceTimers.get(fullPath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.delete(fullPath);
      void syncFileToAriadne(fullPath, root, options);
    }, DEBOUNCE_MS);

    debounceTimers.set(fullPath, timer);
  });

  return {
    close: () => {
      for (const t of debounceTimers.values()) clearTimeout(t);
      debounceTimers.clear();
      watcher.close();
      console.log(`[Ariadne Live Daemon] Detenido.`);
    },
  };
}

// Ejecución directa si se invoca desde CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || process.cwd();
  startLiveWatcher({ workspaceRoot: root });
}
