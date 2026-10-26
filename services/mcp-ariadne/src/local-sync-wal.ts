/**
 * @fileoverview Write-Ahead Log (WAL) local para el Daemon de sincronización en vivo.
 *
 * Permite trabajar sin conexión (en aviones, caídas de red o reinicios de FalkorDB / Ingest).
 * Todos los deltas locales no enviados se guardan en un registro transaccional en disco
 * (.ariadne/live-sync.wal) y se aplican en bloque con deduplicación atómica en cuanto
 * el servicio vuelve a estar disponible.
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export interface WalEntry {
  path: string;
  content: string;
  isDeleted: boolean;
  timestamp: number;
  projectId?: string;
  repoId?: string;
}

export class LocalSyncWal {
  private walFilePath: string;
  private inMemoryQueue: Map<string, WalEntry> = new Map();
  private isLoaded = false;

  constructor(workspaceRoot: string) {
    const ariadneDir = join(workspaceRoot, ".ariadne");
    this.walFilePath = join(ariadneDir, "live-sync.wal");

    // Fallback a tmpdir si el workspace es de solo lectura
    try {
      if (!existsSync(ariadneDir)) {
        // Inicializar perezosamente al escribir
      }
    } catch {
      this.walFilePath = join(tmpdir(), `ariadne-live-sync-${Buffer.from(workspaceRoot).toString("hex").slice(0, 16)}.wal`);
    }
  }

  /** Carga entradas pendientes de disco a memoria en el arranque */
  async load(): Promise<number> {
    if (this.isLoaded) return this.inMemoryQueue.size;
    this.isLoaded = true;

    try {
      if (!existsSync(this.walFilePath)) return 0;
      const raw = await readFile(this.walFilePath, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as WalEntry;
          if (entry && entry.path) {
            this.inMemoryQueue.set(entry.path, entry);
          }
        } catch {
          // Ignorar línea corrupta
        }
      }
    } catch (err) {
      console.warn(`[Ariadne WAL] Advertencia al leer log previo: ${err}`);
    }

    return this.inMemoryQueue.size;
  }

  /**
   * Encola o actualiza un delta no entregado.
   * Si ya existe un delta para el mismo archivo, se sobreescribe con la versión más reciente.
   */
  async enqueue(entry: Omit<WalEntry, "timestamp">): Promise<void> {
    await this.load();

    const fullEntry: WalEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.inMemoryQueue.set(entry.path, fullEntry);
    await this.persistToDisk();
  }

  /** Retorna todas las entradas pendientes ordenadas cronológicamente */
  async getPendingEntries(): Promise<WalEntry[]> {
    await this.load();
    return Array.from(this.inMemoryQueue.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Elimina un delta sincronizado con éxito */
  async markCompleted(path: string): Promise<void> {
    await this.load();
    if (this.inMemoryQueue.delete(path)) {
      await this.persistToDisk();
    }
  }

  /** Limpia todo el log */
  async clear(): Promise<void> {
    this.inMemoryQueue.clear();
    try {
      if (existsSync(this.walFilePath)) {
        await unlink(this.walFilePath);
      }
    } catch {
      // Ignorar
    }
  }

  /** Cantidad de deltas pendientes */
  async count(): Promise<number> {
    await this.load();
    return this.inMemoryQueue.size;
  }

  private async persistToDisk(): Promise<void> {
    try {
      if (this.inMemoryQueue.size === 0) {
        if (existsSync(this.walFilePath)) {
          await unlink(this.walFilePath);
        }
        return;
      }

      const dir = dirname(this.walFilePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      const lines = Array.from(this.inMemoryQueue.values()).map((e) => JSON.stringify(e));
      await writeFile(this.walFilePath, lines.join("\n") + "\n", "utf-8");
    } catch (err) {
      console.warn(`[Ariadne WAL] Error al persistir WAL en ${this.walFilePath}: ${err}`);
    }
  }
}
