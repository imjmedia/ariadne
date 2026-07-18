/**
 * Paths que no deben aparecer como candidatos a eliminar en mode=codigo_muerto.
 * El grafo indexa manifiestos, HTML de entrada y configs sin aristas IMPORTS/CONTAINS exportables.
 */

const SCHEMA_RELATIONAL_RAG_SOURCE_PATH = 'graph-internal/relational-schema-rag-index.md';
const LEGACY_SCHEMA_RELATIONAL_RAG_PATH = 'ariadne-internal/relational-schema-rag-index.md';

function normalizePath(raw: string): string {
  return raw.replace(/\\/g, '/').trim();
}

function basename(path: string): string {
  const p = normalizePath(path);
  return p.split('/').pop() ?? p;
}

function isSchemaRelationalRagEvidencePath(raw: string): boolean {
  const p = normalizePath(raw).toLowerCase();
  return p === SCHEMA_RELATIONAL_RAG_SOURCE_PATH || p === LEGACY_SCHEMA_RELATIONAL_RAG_PATH;
}

/** Manifiestos, configs de build, docs y assets estáticos — no son "código muerto" eliminable. */
export function isCodigoMuertoInfrastructurePath(raw: string): boolean {
  const path = normalizePath(raw);
  if (!path) return false;
  const base = basename(path);
  const lower = path.toLowerCase();
  const baseLower = base.toLowerCase();

  if (isSchemaRelationalRagEvidencePath(path)) return false;

  if (/\.(md|mdx|rst)$/i.test(base)) return true;

  if (/\.html?$/i.test(base)) return true;

  if (/\.d\.ts$/i.test(base) || baseLower === 'vite-env.d.ts') return true;

  if (isCodigoMuertoEntryPath(path)) return true;

  if (
    baseLower === 'package.json' ||
    baseLower === 'package-lock.json' ||
    baseLower === 'pnpm-lock.yaml' ||
    baseLower === 'pnpm-workspace.yaml' ||
    baseLower === 'yarn.lock' ||
    baseLower === 'bun.lockb' ||
    baseLower === 'composer.json' ||
    baseLower === 'requirements.txt' ||
    baseLower === 'go.mod' ||
    baseLower === 'cargo.toml' ||
    baseLower === 'dockerfile' ||
    baseLower === 'docker-compose.yml' ||
    baseLower === 'docker-compose.yaml' ||
    baseLower === 'makefile' ||
    baseLower === 'gemfile' ||
    baseLower === 'procfile'
  ) {
    return true;
  }

  if (/^tsconfig(\..+)?\.json$/i.test(base)) return true;
  if (/^jsconfig\.json$/i.test(base)) return true;

  if (/\.config\.(js|mjs|cjs|ts|mts|cts)$/i.test(base)) return true;

  if (
    /^(vite|vitest|jest|playwright|webpack|rollup|tailwind|postcss|eslint|biome|prettier|stylelint|commitlint|lint-staged|babel|nuxt|next|astro|svelte|turbo|knip|cypress|mermaid|drizzle|prisma|nest-cli|angular|capacitor|ionic|electron|storybook|stylelint|commitlint)\./i.test(
      baseLower,
    )
  ) {
    return true;
  }

  if (/^ecosystem[.-].*\.config\.(js|mjs|cjs)$/i.test(base)) return true;

  if (/^\.env(\..+)?$/i.test(base) || baseLower === '.env.example') return true;

  if (/\.(css|scss|sass|less|styl)$/i.test(base)) return true;

  if (/\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|webm|pdf|zip|tar|gz)$/i.test(base)) {
    return true;
  }

  if (/\.json$/i.test(base)) {
    if (/openapi|swagger|full_documentation/i.test(base)) return true;
    if (lower.includes('/content-types/') || lower.includes('/extensions/')) return true;
    return true;
  }

  if (
    lower.startsWith('.github/') ||
    lower.startsWith('.vscode/') ||
    lower.startsWith('.cursor/') ||
    lower.startsWith('docs/') ||
    lower.startsWith('documents/')
  ) {
    return true;
  }

  return false;
}

/** Puntos de entrada Vite/React (main.tsx, index.tsx, App.tsx) en monorepos y raíz. */
export function isCodigoMuertoEntryPath(raw: string): boolean {
  const path = normalizePath(raw);
  const base = basename(path);
  const lower = path.toLowerCase();

  if (/(^|\/)src\/(index|main|app|bootstrap|_app|_document)\.(tsx?|jsx?)$/i.test(lower)) {
    return true;
  }
  if (/^(index|main|app|bootstrap|_app|_document)\.(tsx?|jsx?)$/i.test(base)) {
    return lower.startsWith('src/') || !lower.includes('/');
  }
  return false;
}
