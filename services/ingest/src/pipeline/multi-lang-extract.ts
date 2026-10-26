/**
 * Extractor AST multi-lenguaje (Python, Go, Rust) para Ariadne Ingest.
 * Permite que microservicios y proyectos políglotas tengan sus funciones,
 * clases, modelos, structs, imports y rutas HTTP indexados en FalkorDB.
 */

export interface ImportInfo {
  specifier: string;
  isDefault: boolean;
  localNames: string[];
}

export interface FunctionInfo {
  name: string;
  lineRange?: { start: number; end: number };
  description?: string;
  complexity?: number;
  nestingDepth?: number;
}

export interface ComponentInfo {
  name: string;
  type: 'Class' | 'Functional';
  isLegacy: boolean;
  description?: string;
}

export interface ModelInfo {
  name: string;
  source?: 'heuristic' | 'typeorm' | 'frontend';
  tableName?: string;
  description?: string;
}

export interface RouteInfo {
  path: string;
  componentName: string;
  routeSource?: 'react-router-jsx' | 'tanstack' | 'browser-router' | 'landing-heuristic';
}

export interface MultiLangExtractResult {
  imports: ImportInfo[];
  functions: FunctionInfo[];
  components: ComponentInfo[];
  models: ModelInfo[];
  routes: RouteInfo[];
}

/** Extrae docstring de Python (comillas triples) al inicio de una función o clase */
function extractPythonDocstring(lines: string[], startLineIdx: number): string | undefined {
  for (let i = startLineIdx; i < Math.min(startLineIdx + 5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.startsWith('"""') || line.startsWith("'''")) {
      const quote = line.slice(0, 3);
      if (line.length > 3 && line.slice(3).includes(quote)) {
        return line.slice(3, line.indexOf(quote, 3)).trim();
      }
      const docLines: string[] = [line.slice(3)];
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j].includes(quote)) {
          docLines.push(lines[j].slice(0, lines[j].indexOf(quote)));
          return docLines.join(' ').trim();
        }
        docLines.push(lines[j].trim());
      }
    }
  }
  return undefined;
}

/** Calcula complejidad ciclomática aproximada (decisiones: if, for, while, etc.) */
function calculateComplexity(lines: string[]): number {
  let complexity = 1;
  const decisionRegex = /\b(if|elif|else\s+if|for|while|case|except|catch|match)\b|&&|\|\|/g;
  for (const line of lines) {
    const matches = line.match(decisionRegex);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

// -------------------------------------------------------------
// EXTRACTOR PYTHON (.py)
// -------------------------------------------------------------
export function extractPython(source: string, filePath: string): MultiLangExtractResult {
  const lines = source.split(/\r?\n/);
  const imports: ImportInfo[] = [];
  const functions: FunctionInfo[] = [];
  const components: ComponentInfo[] = [];
  const models: ModelInfo[] = [];
  const routes: RouteInfo[] = [];

  let currentClass: string | null = null;
  let currentClassIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const indent = rawLine.search(/\S/);
    if (currentClass && indent <= currentClassIndent) {
      currentClass = null;
      currentClassIndent = -1;
    }

    // Imports: from x import y, z
    const fromImportMatch = line.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
    if (fromImportMatch) {
      const specifier = fromImportMatch[1];
      const localNames = fromImportMatch[2]
        .split(',')
        .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      imports.push({ specifier, isDefault: false, localNames });
      continue;
    }

    // Imports: import x, y
    const importMatch = line.match(/^import\s+(.+)$/);
    if (importMatch) {
      const parts = importMatch[1].split(',');
      for (const p of parts) {
        const specifier = p.trim().split(/\s+as\s+/)[0].trim();
        if (specifier) imports.push({ specifier, isDefault: true, localNames: [specifier] });
      }
      continue;
    }

    // Rutas FastAPI / Flask (decoradores: @app.get, @router.post, etc.)
    const routeDecMatch = line.match(/^@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i);
    if (routeDecMatch) {
      const method = routeDecMatch[1].toUpperCase();
      const routePath = routeDecMatch[2];
      // Buscar siguiente def
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const defMatch = lines[j].match(/^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)/);
        if (defMatch) {
          routes.push({
            path: routePath,
            componentName: `${method} ${routePath}`,
          });
          break;
        }
      }
    }

    // Clases / Modelos: class User(BaseModel):
    const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)(?:\s*\(([^)]*)\))?:/);
    if (classMatch) {
      const className = classMatch[1];
      const baseClasses = classMatch[2] ? classMatch[2].split(',').map((b) => b.trim()) : [];
      currentClass = className;
      currentClassIndent = indent;

      const desc = extractPythonDocstring(lines, i + 1);
      components.push({
        name: className,
        type: 'Class',
        isLegacy: false,
        description: desc,
      });

      const isModel = baseClasses.some((b) =>
        /model|entity|base|schema|document|table/i.test(b),
      );
      if (isModel || /models?\.py/i.test(filePath)) {
        models.push({
          name: className,
          tableName: className.toLowerCase(),
          source: 'heuristic',
        });
      }
      continue;
    }

    // Funciones / Métodos: def foo(...):
    const defMatch = line.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (defMatch) {
      const fnName = currentClass ? `${currentClass}.${defMatch[1]}` : defMatch[1];
      let endLine = i + 1;
      const fnIndent = indent;
      for (let j = i + 1; j < lines.length; j++) {
        const nextRaw = lines[j];
        if (!nextRaw.trim() || nextRaw.trim().startsWith('#')) continue;
        const nextIndent = nextRaw.search(/\S/);
        if (nextIndent <= fnIndent) {
          endLine = j;
          break;
        }
        endLine = j + 1;
      }

      const bodyLines = lines.slice(i, endLine);
      const desc = extractPythonDocstring(lines, i + 1);
      functions.push({
        name: fnName,
        lineRange: { start: i + 1, end: endLine },
        description: desc,
        complexity: calculateComplexity(bodyLines),
        nestingDepth: Math.max(1, Math.floor((fnIndent + 4) / 4)),
      });
    }
  }

  return { imports, functions, components, models, routes };
}

// -------------------------------------------------------------
// EXTRACTOR GO (.go)
// -------------------------------------------------------------
export function extractGo(source: string, filePath: string): MultiLangExtractResult {
  const lines = source.split(/\r?\n/);
  const imports: ImportInfo[] = [];
  const functions: FunctionInfo[] = [];
  const components: ComponentInfo[] = [];
  const models: ModelInfo[] = [];
  const routes: RouteInfo[] = [];

  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    // Bloque import ( ... )
    if (line === 'import (') {
      inImportBlock = true;
      continue;
    }
    if (inImportBlock) {
      if (line === ')') {
        inImportBlock = false;
        continue;
      }
      const match = line.match(/^(?:([a-zA-Z0-9_]+)\s+)?["']([^"']+)["']/);
      if (match) {
        const specifier = match[2];
        const alias = match[1] || specifier.split('/').pop() || specifier;
        imports.push({ specifier, isDefault: true, localNames: [alias] });
      }
      continue;
    }

    // Import individual: import "fmt"
    const singleImportMatch = line.match(/^import\s+(?:([a-zA-Z0-9_]+)\s+)?["']([^"']+)["']/);
    if (singleImportMatch) {
      const specifier = singleImportMatch[2];
      const alias = singleImportMatch[1] || specifier.split('/').pop() || specifier;
      imports.push({ specifier, isDefault: true, localNames: [alias] });
      continue;
    }

    // Struct / Interface: type User struct { ... }
    const typeMatch = line.match(/^type\s+([a-zA-Z0-9_]+)\s+(struct|interface)\b/);
    if (typeMatch) {
      const typeName = typeMatch[1];
      const kind = typeMatch[2];
      components.push({
        name: typeName,
        type: 'Class',
        isLegacy: false,
      });

      if (kind === 'struct') {
        models.push({
          name: typeName,
          tableName: typeName.toLowerCase(),
          source: 'heuristic',
        });
      }
      continue;
    }

    // Funciones y métodos: func Foo(...) or func (r *Repo) Bar(...)
    const funcMatch = line.match(/^func\s*(?:\((?:[a-zA-Z0-9_*]+\s+)?\*?([a-zA-Z0-9_]+)\)\s*)?([a-zA-Z0-9_]+)\s*\(/);
    if (funcMatch) {
      const receiver = funcMatch[1];
      const rawName = funcMatch[2];
      const fnName = receiver ? `${receiver}.${rawName}` : rawName;

      // Buscar fin de la función por balanceo de llaves
      let braceCount = 0;
      let started = false;
      let endLine = i + 1;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const char of l) {
          if (char === '{') {
            braceCount++;
            started = true;
          } else if (char === '}') {
            braceCount--;
          }
        }
        if (started && braceCount <= 0) {
          endLine = j + 1;
          break;
        }
      }

      const bodyLines = lines.slice(i, endLine);
      functions.push({
        name: fnName,
        lineRange: { start: i + 1, end: endLine },
        complexity: calculateComplexity(bodyLines),
        nestingDepth: 1,
      });
    }

    // Rutas Gin / Echo / HTTP: r.GET("/path", handler)
    const routeMatch = line.match(/\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']/i);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const rPath = routeMatch[2];
      routes.push({
        path: rPath,
        componentName: `${method} ${rPath}`,
      });
    }
  }

  return { imports, functions, components, models, routes };
}

// -------------------------------------------------------------
// EXTRACTOR RUST (.rs)
// -------------------------------------------------------------
export function extractRust(source: string, filePath: string): MultiLangExtractResult {
  const lines = source.split(/\r?\n/);
  const imports: ImportInfo[] = [];
  const functions: FunctionInfo[] = [];
  const components: ComponentInfo[] = [];
  const models: ModelInfo[] = [];
  const routes: RouteInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    // Use statements: use std::collections::HashMap;
    const useMatch = line.match(/^use\s+([a-zA-Z0-9_:]+)(?:::\{([^}]+)\})?;/);
    if (useMatch) {
      const base = useMatch[1];
      const items = useMatch[2] ? useMatch[2].split(',').map((x) => x.trim()) : [base.split('::').pop() || base];
      imports.push({
        specifier: base,
        isDefault: false,
        localNames: items.filter(Boolean),
      });
      continue;
    }

    // Struct / Enum: struct User { ... } or enum Status { ... }
    const structMatch = line.match(/^(?:pub(?:\([^)]+\))?\s+)?(struct|enum)\s+([a-zA-Z0-9_]+)/);
    if (structMatch) {
      const name = structMatch[2];
      components.push({
        name,
        type: 'Class',
        isLegacy: false,
      });
      if (structMatch[1] === 'struct') {
        models.push({
          name,
          tableName: name.toLowerCase(),
          source: 'heuristic',
        });
      }
      continue;
    }

    // Functions: fn foo(...) or pub async fn bar(...)
    const fnMatch = line.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]+>)?\s*\(/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      let braceCount = 0;
      let started = false;
      let endLine = i + 1;
      for (let j = i; j < lines.length; j++) {
        for (const char of lines[j]) {
          if (char === '{') {
            braceCount++;
            started = true;
          } else if (char === '}') {
            braceCount--;
          }
        }
        if (started && braceCount <= 0) {
          endLine = j + 1;
          break;
        }
      }

      const bodyLines = lines.slice(i, endLine);
      functions.push({
        name: fnName,
        lineRange: { start: i + 1, end: endLine },
        complexity: calculateComplexity(bodyLines),
        nestingDepth: 1,
      });
    }

    // Actix / Axum / Rocket endpoints: #[get("/path")]
    const routeAttrMatch = line.match(/^#\[(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i);
    if (routeAttrMatch) {
      const method = routeAttrMatch[1].toUpperCase();
      const rPath = routeAttrMatch[2];
      routes.push({
        path: rPath,
        componentName: `${method} ${rPath}`,
      });
    }
  }

  return { imports, functions, components, models, routes };
}

/**
 * Función principal para extraer entidades de lenguajes externos (Python, Go, Rust).
 * Retorna null si la extensión del archivo no corresponde a estos lenguajes.
 */
export function extractMultiLangSource(path: string, source: string): MultiLangExtractResult | null {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.py':
      return extractPython(source, path);
    case '.go':
      return extractGo(source, path);
    case '.rs':
      return extractRust(source, path);
    default:
      return null;
  }
}
