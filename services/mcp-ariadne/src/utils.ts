import fs from "node:fs";
import path from "node:path";

export interface AriadneProjectConfig {
  projectId: string;
  defaultRepoId?: string;
  pathPrefixes?: Record<string, string>;
}

/**
 * Busca y carga el archivo .ariadne-project progresando hacia arriba desde el directorio actual
 * o el directorio del proceso.
 */
export function loadAriadneProjectConfig(currentDir?: string): AriadneProjectConfig | null {
  let startDir = currentDir || process.cwd();

  while (startDir !== path.parse(startDir).root) {
    const configPath = path.join(startDir, ".ariadne-project");
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as AriadneProjectConfig;
      } catch (e) {
        console.error("Error al leer .ariadne-project:", e);
        return null;
      }
    }
    /** Repos Cursor / Relic suelen tener `.relic-project` con `projectId` (proyecto o root repo). */
    const relicPath = path.join(startDir, ".relic-project");
    if (fs.existsSync(relicPath)) {
      try {
        const content = fs.readFileSync(relicPath, "utf-8");
        const j = JSON.parse(content) as Record<string, unknown>;
        const pid = typeof j.projectId === "string" ? j.projectId.trim() : "";
        if (pid) {
          const out: AriadneProjectConfig = { projectId: pid };
          if (typeof j.defaultRepoId === "string") out.defaultRepoId = j.defaultRepoId;
          if (
            j.pathPrefixes &&
            typeof j.pathPrefixes === "object" &&
            !Array.isArray(j.pathPrefixes)
          ) {
            out.pathPrefixes = j.pathPrefixes as Record<string, string>;
          }
          return out;
        }
      } catch (e) {
        console.error("Error al leer .relic-project:", e);
      }
    }
    startDir = path.dirname(startDir);
  }
  return null;
}

/**
 * Carga `.ariadne-project` subiendo directorios desde el fichero abierto en el IDE (no solo cwd).
 */
export function loadAriadneProjectConfigNearFile(filePath: string | undefined | null): AriadneProjectConfig | null {
  if (!filePath?.trim()) return loadAriadneProjectConfig();
  const dir = path.dirname(path.resolve(filePath));
  return loadAriadneProjectConfig(dir);
}

/**
 * Resuelve un path relativo del grafo a un path absoluto usando la configuración.
 */
export function resolveAbsolutePath(
  relativePath: string,
  repoId?: string | null,
  config?: AriadneProjectConfig | null
): string {
  if (!config || !config.pathPrefixes || !repoId) return relativePath;
  
  const prefix = config.pathPrefixes[repoId];
  if (!prefix) return relativePath;
  
  return path.join(prefix, relativePath);
}
