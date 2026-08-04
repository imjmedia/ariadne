/**
 * Parse Ariadne `# Tasks` markdown (YAML blocks) → Forge tasksJson v2 seed shape.
 * Mirror of @theforge/shared-types parse-ariadne-cursor-tasks-markdown.util.ts
 */
import type { ForgeTasksJsonSeedTask, ForgeTasksJsonSeedV2 } from './forge-tasks-json-seed.util';

export type ParseCursorTasksMarkdownResult =
  | { ok: true; seed: ForgeTasksJsonSeedV2 }
  | { ok: false; errors: string[] };

function trimLines(md: string): string[] {
  return md.replace(/\r\n/g, '\n').split('\n');
}

function parseScalarValue(raw: string): unknown {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const keyMatch = line.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/);
    if (!keyMatch) {
      i++;
      continue;
    }
    const key = keyMatch[1]!;
    const rest = keyMatch[2] ?? '';
    if (rest.trim() === '' || rest.trim() === '|' || rest.trim() === '>') {
      const nested: unknown[] = [];
      const nestedObj: Record<string, unknown> = {};
      let j = i + 1;
      let isArray = false;
      let isNestedObj = false;
      while (j < lines.length) {
        const nl = lines[j]!;
        if (/^\S/.test(nl) && nl.trim()) break;
        const arrMatch = nl.match(/^\s+-\s+(.*)$/);
        if (arrMatch) {
          isArray = true;
          nested.push(parseScalarValue(arrMatch[1] ?? ''));
          j++;
          continue;
        }
        const objMatch = nl.match(/^\s+([a-zA-Z0-9_.-]+):\s*(.*)$/);
        if (objMatch) {
          isNestedObj = true;
          nestedObj[objMatch[1]!] = parseScalarValue(objMatch[2] ?? '');
          j++;
          continue;
        }
        if (!nl.trim()) {
          j++;
          continue;
        }
        break;
      }
      if (isArray) out[key] = nested;
      else if (isNestedObj) out[key] = nestedObj;
      i = j;
      continue;
    }
    out[key] = parseScalarValue(rest);
    i++;
  }
  return out;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        /* ignore */
      }
    }
    if (t) return [t];
  }
  return [];
}

function extractScopeIncludeFromYamlText(yaml: string): string[] {
  const paths: string[] = [];
  let inInclude = false;
  for (const line of yaml.split('\n')) {
    if (/^\s*include:\s*$/.test(line)) {
      inInclude = true;
      continue;
    }
    if (inInclude) {
      const item = line.match(/^\s+-\s+(.+)$/);
      if (item) {
        paths.push(String(parseScalarValue(item[1] ?? '')));
        continue;
      }
      if (/^\S/.test(line.trim()) || (/^\s+[A-Za-z_]+:/.test(line) && !/^\s+-/.test(line))) {
        inInclude = false;
      }
    }
  }
  return paths;
}
function extractScopeInclude(fm: Record<string, unknown>, yamlText?: string): string[] {
  const scope = fm.scope;
  if (scope && typeof scope === 'object') {
    const fromScope = readStringArray((scope as Record<string, unknown>).include);
    if (fromScope.length) return fromScope;
  }
  const flat = readStringArray(fm.scope_include ?? fm.scopeInclude);
  if (flat.length) return flat;
  if (yamlText?.trim()) return extractScopeIncludeFromYamlText(yamlText);
  return [];
}

function extractDependsOn(fm: Record<string, unknown>): string[] {
  return readStringArray(fm.depends_on ?? fm.dependsOn ?? fm.dependencies);
}

function extractStoryRef(fm: Record<string, unknown>): string | undefined {
  const ctx = fm.context;
  if (ctx && typeof ctx === 'object') {
    const ref = (ctx as Record<string, unknown>).story_ref;
    if (typeof ref === 'string' && ref.trim()) return ref.trim();
  }
  return undefined;
}

function extractFiles(fm: Record<string, unknown>, scopeInclude: string[]): string[] {
  const direct = readStringArray(fm.files ?? fm.target_files ?? fm.targetFiles);
  if (direct.length) return direct;
  if (scopeInclude.length) return scopeInclude;
  return [];
}

function derivePhaseFromHeading(heading: string | null, section: string): string {
  if (heading) {
    const m = heading.match(/Fase\s+(\d+(?:\.\d+)?)/i);
    if (m) return m[1]!;
  }
  if (/backend/i.test(section)) return 'backend';
  if (/frontend/i.test(section)) return 'frontend';
  return section.trim() || 'Integration';
}

/** Parses `# Tasks` markdown into Forge tasksJson v2 seed. */
export function parseCursorTasksMarkdownToSeed(
  markdown: string,
  meta: {
    projectId: string;
    changeDescription: string;
    ariadneChangeId: string;
    promotionScope?: ForgeTasksJsonSeedV2['promotionScope'];
    generatedAt?: string;
  },
): ParseCursorTasksMarkdownResult {
  const errors: string[] = [];
  const lines = trimLines(markdown);
  let currentSection = 'Integration';
  let currentPhaseHeading: string | null = null;
  const tasks: ForgeTasksJsonSeedTask[] = [];
  const fileMap = new Map<string, { path: string; repoId?: string }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const phaseMatch = line.match(/^###\s+(.+)$/);
    if (phaseMatch) {
      currentPhaseHeading = phaseMatch[1]!.trim();
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.trim();
      continue;
    }

    if (line.trim() !== '---') continue;

    const yamlLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() !== '---') {
      yamlLines.push(lines[j]!);
      j++;
    }
    if (j >= lines.length) {
      errors.push(`Unclosed YAML block at line ${i + 1}`);
      break;
    }

    let fm: Record<string, unknown>;
    try {
      fm = parseSimpleYaml(yamlLines.join('\n'));
    } catch (e) {
      errors.push(
        `Invalid YAML at line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
      );
      i = j;
      continue;
    }

    const yamlText = yamlLines.join('\n');
    const id = String(fm.id ?? '').trim();
    const title = String(fm.title ?? '').trim();
    const scopeInclude = extractScopeInclude(fm, yamlText);
    const files = extractFiles(fm, scopeInclude).map((p) => p.replace(/\\/g, '/'));
    const dependsOn = extractDependsOn(fm);

    if (!id) errors.push(`Task at line ${i + 1} missing id`);
    if (!title) errors.push(`Task at line ${i + 1} missing title`);
    if (!files.length) errors.push(`Task ${id || '?'} missing files/scope.include`);

    if (id && title && files.length) {
      const phase =
        String(fm.phase ?? fm.section ?? '').trim() ||
        derivePhaseFromHeading(currentPhaseHeading, currentSection);
      const storyRef = extractStoryRef(fm);
      const criterion =
        typeof fm.criterion === 'string'
          ? fm.criterion
          : readStringArray(fm.requirements)[0];
      tasks.push({
        id,
        title,
        files,
        ...(readStringArray(fm.symbols).length ? { symbols: readStringArray(fm.symbols) } : {}),
        phase,
        ...(criterion ? { criterion } : {}),
        ...(dependsOn.length ? { dependsOn } : {}),
        status: 'pending',
        source: 'ariadne_cursor_tasks_markdown',
        ...(storyRef ? { storyRef } : {}),
      });
      for (const path of files) {
        if (!fileMap.has(path)) fileMap.set(path, { path });
      }
    }

    i = j;
  }

  if (!tasks.length) {
    return { ok: false, errors: errors.length ? errors : ['no tasks parsed from markdown'] };
  }

  return {
    ok: true,
    seed: {
      schemaVersion: '2',
      source: 'ariadne',
      projectId: meta.projectId,
      changeDescription: meta.changeDescription.slice(0, 2000),
      ariadneChangeId: meta.ariadneChangeId,
      ...(meta.promotionScope ? { promotionScope: meta.promotionScope } : {}),
      tasks,
      files: [...fileMap.values()],
    },
  };
}
