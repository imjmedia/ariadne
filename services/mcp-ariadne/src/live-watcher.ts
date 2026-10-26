#!/usr/bin/env node
/**
 * @fileoverview Ariadne Live Daemon (Cursor Workspace Watcher) con Write-Ahead Log (WAL)
 *
 * Vigila los eventos de guardado y cambio de archivos en el workspace local de Cursor,
 * enviando deltas atómicos directos al grafo FalkorDB (vía Ingest) en milisegundos,
 * eliminando la necesidad de hacer commit y push a Bitbucket para refrescar el contexto.
 *
 * Soporta modo offline transparente: si la conexión con Ingest/FalkorDB se pierde o
 * estás programando en un avión sin red, los deltas se encolan atómicamente en un WAL
 * local en disco (.ariadne/live-sync.wal) y se reintentan en bloque al reconectar.
 */

import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { LocalSyncWal, type WalEntry } from "./local-sync-wal.js";

const WATCH_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".prisma",
  ".py",
  ".go",
  ".rs",
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
  ".ariadne",
];

const INGEST_URL = (
  process.env.INGEST_URL ??
  process.env.ARIADNESPEC_INGEST_URL ??
  "http://localhost:3002"
).replace(/\/$/, "");

const DEBOUNCE_MS = 300;
const REPLAY_INTERVAL_MS = 5000;
const debounceTimers = new Map<string, NodeJS.Timeout>();

export interface LiveWatcherOptions {
  workspaceRoot?: string;
  projectId?: string;
  repoId?: string;
  wal?: LocalSyncWal;
}

export function shouldIgnore(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return IGNORED_DIRS.some((d) => norm.includes(`/${d}/`) || norm.startsWith(`${d}/`));
}

/**
 * Intenta enviar un payload delta directo a Ingest.
 * Retorna true si tuvo éxito, o false si la conexión falló o hubo un 5xx.
 */
async function postFileDelta(
  relPath: string,
  content: string,
  isDeleted: boolean,
  options: LiveWatcherOptions = {},
): Promise<boolean> {
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
      console.warn(
        `[Ariadne Live Daemon] ⚠️ Error ${res.status} sincronizando ${relPath}: ${errText.slice(0, 150)}`,
      );
      return false;
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
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Ariadne Live Daemon] ❌ Conexión no disponible con ${INGEST_URL}: ${msg}`);
    return false;
  }
}

/**
 * Reintenta en bloque todos los deltas pendientes acumulados en el WAL offline.
 */
let isReplayingWal = false;
export async function flushPendingWal(wal: LocalSyncWal, options: LiveWatcherOptions = {}): Promise<void> {
  if (isReplayingWal) return;
  const count = await wal.count();
  if (count === 0) return;

  isReplayingWal = true;
  try {
    const pending = await wal.getPendingEntries();
    console.log(`[Ariadne WAL] 🔄 Reintentando ${pending.length} deltas pendientes de sesión offline...`);
    let synced = 0;

    for (const entry of pending) {
      const ok = await postFileDelta(entry.path, entry.content, entry.isDeleted, {
        ...options,
        projectId: entry.projectId ?? options.projectId,
        repoId: entry.repoId ?? options.repoId,
      });

      if (ok) {
        await wal.markCompleted(entry.path);
        synced++;
      } else {
        console.warn(`[Ariadne WAL] ⏸️ Replay pausado. Conexión aún no disponible.`);
        break;
      }
    }

    if (synced > 0) {
      const remaining = await wal.count();
      console.log(`[Ariadne WAL] ✅ ${synced} deltas aplicados en bloque. Restantes en cola: ${remaining}`);
    }
  } finally {
    isReplayingWal = false;
  }
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

  const ok = await postFileDelta(relPath, content, isDeleted, options);

  if (!ok && options.wal) {
    // Si la llamada falló, encolar en el WAL para que no se pierda el trabajo
    await options.wal.enqueue({
      path: relPath,
      content,
      isDeleted,
      projectId: options.projectId,
      repoId: options.repoId,
    });
    console.log(`[Ariadne WAL] 📦 Delta respaldado en WAL local: ${relPath}`);
  } else if (ok && options.wal) {
    await options.wal.markCompleted(relPath);
  }
}

export function startLiveWatcher(options: LiveWatcherOptions = {}): { close: () => void } {
  const root = resolve(options.workspaceRoot || process.cwd());
  const wal = options.wal || new LocalSyncWal(root);
  const optsWithWal = { ...options, workspaceRoot: root, wal };

  console.log(`[Ariadne Live Daemon] 👁️  Vigilando cambios locales en: ${root}`);
  console.log(`[Ariadne Live Daemon] 🔗 Conectado a Ingest: ${INGEST_URL}`);
  console.log(`[Ariadne Live Daemon] 🛡️ WAL local activo para resiliencia offline.`);

  // Revisar y vaciar WAL previo al inicio si hay deltas pendientes
  void flushPendingWal(wal, optsWithWal);

  // Heartbeat de reintento automático para el WAL offline
  const replayInterval = setInterval(() => {
    void flushPendingWal(wal, optsWithWal);
  }, REPLAY_INTERVAL_MS);

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
      void syncFileToAriadne(fullPath, root, optsWithWal);
    }, DEBOUNCE_MS);

    debounceTimers.set(fullPath, timer);
  });

  return {
    close: () => {
      clearInterval(replayInterval);
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
