/**
 * @fileoverview **Navigation Map Scanner** — escanea un proyecto frontend para generar
 * un mapa de navegacion: rutas -> componentes -> subcomponentes -> formularios -> endpoints.
 *
 * Flujo:
 * 1. Detecta el framework de routing (package.json)
 * 2. Encuentra la configuracion de rutas
 * 3. Parsea cada ruta -> componente
 * 4. Para cada componente, resuelve subcomponentes (arbol de imports)
 * 5. Detecta formularios (estaticos y dinamicos)
 * 6. Identifica componentes compartidos (importados desde >=2 rutas)
 * 7. Resuelve path aliases (tsconfig paths)
 * 8. Detecta apiClient centralizado para resolver base URL de endpoints
 * 9. Soporta diff mode (comparacion contra snapshot previo)
 * 10. Soporta persistencia (guardar/actualizar mapa en archivo)
 *
 * Dependencias: `INGEST_URL` para leer archivos, FalkorDB para consultar el grafo.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RouteEntry {
  url: string;
  params: string[];
  screenName: string;
  componentPath: string;
  subComponents: SubComponent[];
  forms: FormEntry[];
  endpoints: EndpointRef[];
  navigation: string[];
  changed?: "added" | "modified" | "removed" | "unchanged";
}

export interface SubComponent {
  path: string;
  name: string;
  isShared: boolean;
  sharedRoutes?: string[];
}

export interface FormEntry {
  name: string;
  file: string;
  type: "static" | "dynamic";
  fields: FormField[];
  submitEndpoint?: string;
  submitMethod?: string;
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  validation?: string;
  placeholder?: string;
  options?: string[];
  schemaSource?: string;
}

export interface EndpointRef {
  method: string;
  path: string;
  usage: string;
  file: string;
}

export interface SharedComponent {
  path: string;
  name: string;
  props?: string;
  forms?: FormEntry[];
  endpoints?: EndpointRef[];
  usedInRoutes: string[];
}

export interface ApiClientInfo {
  name: string;
  baseUrl: string;
  method: string;
  filePath: string;
}

export interface NavigationMap {
  projectId: string;
  framework: string;
  frameworkVersion: string;
  routes: RouteEntry[];
  sharedComponents: SharedComponent[];
  apiClient?: ApiClientInfo;
  pathAliases: Record<string, string>;
  errors: string[];
}

export interface ScannerOptions {
  ingestBase: string;
  projectOrRepoId: string;
  baselineSnapshot?: string;
  persistPath?: string;
}

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

interface FrameworkInfo {
  name: string;
  version: string;
  routePattern: "object" | "filesystem" | "both";
}

export function detectFramework(packageJson: Record<string, unknown>): FrameworkInfo {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> ?? {}),
    ...(packageJson.devDependencies as Record<string, string> ?? {}),
  };

  if (deps["next"]) {
    const v = deps["next"];
    return { name: "next", version: v, routePattern: "filesystem" };
  }
  if (deps["react-router-dom"]) {
    return { name: "react-router-dom", version: deps["react-router-dom"], routePattern: "object" };
  }
  if (deps["@tanstack/react-router"]) {
    return { name: "tanstack-router", version: deps["@tanstack/react-router"], routePattern: "object" };
  }
  if (deps["@angular/router"]) {
    return { name: "angular", version: deps["@angular/router"], routePattern: "object" };
  }
  if (deps["vue-router"]) {
    return { name: "vue-router", version: deps["vue-router"], routePattern: "object" };
  }
  if (deps["@sveltejs/kit"]) {
    return { name: "sveltekit", version: deps["@sveltejs/kit"], routePattern: "filesystem" };
  }
  if (deps["expo-router"]) {
    return { name: "expo-router", version: deps["expo-router"], routePattern: "filesystem" };
  }
  if (deps["@remix-run/react"]) {
    return { name: "remix", version: deps["@remix-run/react"], routePattern: "filesystem" };
  }
  return { name: "unknown", version: "0", routePattern: "object" };
}

// ---------------------------------------------------------------------------
// File reading helpers (via ingest API)
// ---------------------------------------------------------------------------

async function readIngestFile(
  ingestBase: string,
  projectOrRepoId: string,
  path: string,
): Promise<string | null> {
  const base = ingestBase.replace(/\/$/, "");
  const pathQ = "path=" + encodeURIComponent(path);
  let res = await fetch(base + "/repositories/" + projectOrRepoId + "/file?" + pathQ);
  if (res.status === 404) {
    res = await fetch(base + "/projects/" + projectOrRepoId + "/file?" + pathQ);
  }
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string };
  return data.content ?? null;
}

async function readJsonFromIngest(
  ingestBase: string,
  projectOrRepoId: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const content = await readIngestFile(ingestBase, projectOrRepoId, path);
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Lee el listado de archivos de un directorio via ingest API.
 * Nueva ruta: GET /repositories/:id/tree?path=... y GET /projects/:id/tree?path=...
 */
async function listIngestDirectory(
  ingestBase: string,
  projectOrRepoId: string,
  pathPrefix: string,
): Promise<string[]> {
  const base = ingestBase.replace(/\/$/, "");
  const pathQ = "path=" + encodeURIComponent(pathPrefix);
  let res = await fetch(base + "/repositories/" + projectOrRepoId + "/tree?" + pathQ);
  if (res.status === 404) {
    res = await fetch(base + "/projects/" + projectOrRepoId + "/tree?" + pathQ);
  }
  if (!res.ok) return [];
  const data = (await res.json()) as { files?: string[] };
  return data.files ?? [];
}

// ---------------------------------------------------------------------------
// Path alias resolution (from tsconfig.json / jsconfig.json)
// ---------------------------------------------------------------------------

interface PathAliasMap {
  [alias: string]: string; // e.g. "@/*" -> "src/*"
}

export function resolvePathAliases(
  tsconfig: Record<string, unknown> | null,
): PathAliasMap {
  const aliases: PathAliasMap = {};
  if (!tsconfig) return aliases;
  const compilerOptions = tsconfig.compilerOptions as Record<string, unknown> | undefined;
  if (!compilerOptions) return aliases;
  const paths = compilerOptions.paths as Record<string, string[]> | undefined;
  if (!paths) return aliases;

  for (const [alias, targets] of Object.entries(paths)) {
    const target = targets?.[0];
    if (target) {
      // Normalize: "@/*" -> ["@/", "src/"]
      const aliasPrefix = alias.replace(/\*$/, "");
      const targetPrefix = target.replace(/\*$/, "");
      aliases[aliasPrefix] = targetPrefix;
    }
  }
  return aliases;
}

/**
 * Resuelve un import usando path aliases del tsconfig.
 * Ej: "@/components/Button" con alias "@/" -> "src/"  -> "src/components/Button"
 */
export function resolveAliasedPath(
  importPath: string,
  aliases: PathAliasMap,
): string | null {
  for (const [aliasPrefix, targetPrefix] of Object.entries(aliases)) {
    if (importPath.startsWith(aliasPrefix)) {
      const rest = importPath.slice(aliasPrefix.length);
      const resolved = targetPrefix + rest;
      if (!/\.[a-z]+$/i.test(resolved)) {
        return resolved + ".tsx";
      }
      return resolved;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// apiClient detection
// ---------------------------------------------------------------------------

/**
 * Detecta si el proyecto tiene un apiClient centralizado.
 * Busca patrones como:
 * - `const apiFetch = ...` con base URL
 * - `axios.create({ baseURL: "..." })`
 * - `new ApiClient({ baseUrl: "..." })`
 */
async function detectApiClient(
  ingestBase: string,
  projectOrRepoId: string,
): Promise<ApiClientInfo | null> {
  // Common apiClient file paths
  const candidates = [
    "src/lib/api-client.ts",
    "src/lib/apiClient.ts",
    "src/lib/api.ts",
    "src/utils/api-client.ts",
    "src/utils/apiClient.ts",
    "src/utils/api.ts",
    "src/services/api-client.ts",
    "src/services/apiClient.ts",
    "src/services/api.ts",
    "src/api/api-client.ts",
    "src/api/client.ts",
    "src/api/index.ts",
  ];

  for (const path of candidates) {
    const content = await readIngestFile(ingestBase, projectOrRepoId, path);
    if (!content) continue;

    // Pattern: baseURL: "..." or baseUrl = "..."
    const baseUrlMatch = /baseURL\s*[:=]\s*["']([^"']+)["']/.exec(content);
    // Pattern: const apiFetch = ... / export const apiFetch
    const exportMatch = /(?:export\s+)?(?:const|let|var)\s+(apiFetch|apiClient|client)\b/.exec(content);
    // Pattern: axios.create({ ... })
    const axiosMatch = /axios\.create\s*\(\s*\{/.test(content);

    if (baseUrlMatch || exportMatch || axiosMatch) {
      const name = exportMatch?.[1] ?? "apiClient";
      const method = axiosMatch ? "axios" : "fetch";
      return {
        name,
        baseUrl: baseUrlMatch?.[1] ?? "/api",
        method,
        filePath: path,
      };
    }
  }

  // Fallback: search in package.json for api client libs
  const pkg = await readJsonFromIngest(ingestBase, projectOrRepoId, "package.json");
  if (pkg) {
    const deps = {
      ...(pkg.dependencies as Record<string, string> ?? {}),
      ...(pkg.devDependencies as Record<string, string> ?? {}),
    };
    if (deps["axios"]) {
      return { name: "axios", baseUrl: "/api", method: "axios", filePath: "package.json" };
    }
    if (deps["@tanstack/react-query"]) {
      return { name: "react-query", baseUrl: "/api", method: "fetch", filePath: "package.json" };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// React Router object-style route parser
// ---------------------------------------------------------------------------

export function parseReactRouterRoutes(
  content: string,
  _basePath: string,
): Array<{ path: string; componentPath: string }> {
  const routes: Array<{ path: string; componentPath: string }> = [];
  const seen = new Set<string>();

  // Pattern 1: createBrowserRouter([ { path: "...", element: <Component /> } ])
  const routerPattern = /create(?:Browser)?Router\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  const routerMatch = routerPattern.exec(content);
  if (routerMatch) {
    const routeDefs = routerMatch[1];
    const routeObjectPattern = /\{\s*path\s*:\s*["']([^"']+)["'][\s\S]*?(?:element\s*:\s*(?:<([^/>\s]+)|<([^>]+)>))?/g;
    let m: RegExpExecArray | null;
    while ((m = routeObjectPattern.exec(routeDefs)) !== null) {
      const routePath = m[1]!;
      const componentName = (m[2] ?? m[3] ?? "").trim();
      if (!seen.has(routePath)) {
        seen.add(routePath);
        routes.push({ path: routePath, componentPath: componentName || "unknown" });
      }
    }
  }

  // Pattern 2: <Route path="..." element={<Component />} />
  const jsxPattern = /<Route\s+path=["']([^"']+)["'][\s\S]*?element=\{?<(\w+)/g;
  let m2: RegExpExecArray | null;
  while ((m2 = jsxPattern.exec(content)) !== null) {
    const routePath = m2[1]!;
    const componentName = m2[2]!;
    if (!seen.has(routePath)) {
      seen.add(routePath);
      routes.push({ path: routePath, componentPath: componentName });
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Next.js filesystem router parser (dinamico via tree API)
// ---------------------------------------------------------------------------

interface PageFile {
  path: string;       // e.g. "pages/dashboard.tsx"
  routePath: string;  // e.g. "/dashboard"
  isDynamic: boolean;
}

/**
 * Escanea directorios de Next.js (pages/ y app/) usando la API tree.
 * Soporta:
 * - pages/index.tsx -> /
 * - pages/dashboard.tsx -> /dashboard
 * - pages/blog/[slug].tsx -> /blog/:slug
 * - app/page.tsx -> /
 * - app/dashboard/page.tsx -> /dashboard
 * - app/blog/[slug]/page.tsx -> /blog/:slug
 */
async function scanNextJsDirectories(
  ingestBase: string,
  projectOrRepoId: string,
): Promise<PageFile[]> {
  const pages: PageFile[] = [];
  const seen = new Set<string>();

  // Try pages/ directory first (Pages Router)
  const pagesFiles = await listIngestDirectory(ingestBase, projectOrRepoId, "pages");
  if (pagesFiles.length > 0) {
    for (const file of pagesFiles) {
      // Only page files (not components/_app/_document etc)
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx") && !file.endsWith(".ts") && !file.endsWith(".js")) continue;
      if (file.includes("/_")) continue; // _app, _document, _middleware

      // Convert filesystem path to route
      const relPath = file.startsWith("pages/") ? file.slice(6) : file;
      if (relPath === "index.tsx" || relPath === "index.ts" || relPath === "index.jsx" || relPath === "index.js") {
        if (!seen.has("/")) { seen.add("/"); pages.push({ path: file, routePath: "/", isDynamic: false }); }
        continue;
      }

      const routePath = filesystemPathToRoute(relPath);
      if (!seen.has(routePath)) {
        seen.add(routePath);
        pages.push({ path: file, routePath, isDynamic: routePath.includes(":") });
      }
    }
  }

  // Try app/ directory (App Router)
  const appFiles = await listIngestDirectory(ingestBase, projectOrRepoId, "app");
  if (appFiles.length > 0) {
    for (const file of appFiles) {
      // Only page.tsx/page.jsx files
      if (!file.endsWith("/page.tsx") && !file.endsWith("/page.jsx")) continue;

      const relPath = file.startsWith("app/") ? file.slice(4) : file;
      const routeDir = relPath.replace(/\/page\.(tsx|jsx)$/, "");

      if (routeDir === "" || routeDir === "page" || routeDir === "(index)") {
        if (!seen.has("/")) { seen.add("/"); pages.push({ path: file, routePath: "/", isDynamic: false }); }
        continue;
      }

      // Skip route groups: (marketing)/about -> about
      const cleanRoute = routeDir.replace(/\([^)]+\)\//g, "");
      const routePath = filesystemPathToRoute(cleanRoute);
      if (!seen.has(routePath)) {
        seen.add(routePath);
        pages.push({ path: file, routePath, isDynamic: routePath.includes(":") });
      }
    }
  }

  return pages;
}

export function filesystemPathToRoute(relPath: string): string {
  let route = relPath.replace(/\.(tsx|ts|jsx|js)$/, "");
  // Strip pages/ or app/ prefix
    route = route.replace(/^(pages|app)\//, "");
    // Convert [slug] -> :slug
    route = route.replace(/\[([^\]]+)\]/g, ":$1");
    // Convert (group) routes — remove route groups
    route = route.replace(/\/\([^)]+\)/g, "");
    // Handle page.tsx in app router: /dashboard/page -> /dashboard
    route = route.replace(/\/page$/, "");
    // Handle index files
    if (route === "" || route === "index") return "/";
    if (route.endsWith("/index")) {
      route = route.slice(0, -6) || "/";
    }
    return "/" + route;
}

// ---------------------------------------------------------------------------
// Component analysis
// ---------------------------------------------------------------------------

export function analyzeComponent(
  source: string,
  filePath: string,
  pathAliases: PathAliasMap,
): {
  subComponents: SubComponent[];
  forms: FormEntry[];
  endpoints: EndpointRef[];
} {
  const subComponents: SubComponent[] = [];
  const forms: FormEntry[] = [];
  const endpoints: EndpointRef[] = [];

  if (!source) return { subComponents, forms, endpoints };

  // ---- Subcomponents: local imports ----
  const importRegex = /import\s+(?:\{[^}]*\}|[^;{]+)\s+from\s+["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    const importPath = m[1]!;
    const dir = filePath.substring(0, filePath.lastIndexOf("/") + 1);
    const resolved = resolveRelativePath(dir, importPath);
    if (resolved && !resolved.startsWith("node_modules")) {
      subComponents.push({
        path: resolved,
        name: importPath.split("/").pop() ?? resolved,
        isShared: false,
      });
    }
  }

  // ---- Subcomponents: aliased imports (@/, ~/, etc.) ----
  const aliasImportRegex = /import\s+(?:\{[^}]*\}|[^;{]+)\s+from\s+["'](@[^"']+|~[^"']+|[a-z][\w-]*\/[^"']+)["']/g;
  let am: RegExpExecArray | null;
  while ((am = aliasImportRegex.exec(source)) !== null) {
    const importPath = am[1]!;
    const resolved = resolveAliasedPath(importPath, pathAliases);
    if (resolved && !resolved.startsWith("node_modules")) {
      subComponents.push({
        path: resolved,
        name: importPath.split("/").pop() ?? resolved,
        isShared: false,
      });
    }
  }

  // ---- Forms: static ----
  const inputPattern = /<input\s+([^>]*?)\/?>/gs;
  let inputMatch: RegExpExecArray | null;
  const formFields: FormField[] = [];
  const fieldNames = new Set<string>();
  while ((inputMatch = inputPattern.exec(source)) !== null) {
    const attrs = inputMatch[1]!;
    const nameMatch = /name\s*=\s*["']([^"']+)["']/.exec(attrs);
    const typeMatch = /type\s*=\s*["']([^"']+)["']/.exec(attrs);
    const required = /\brequired\b/.test(attrs);
    const placeholderMatch = /placeholder\s*=\s*["']([^"']+)["']/.exec(attrs);
    const patternMatch = /pattern\s*=\s*["']([^"']+)["']/.exec(attrs);
    const maxLengthMatch = /maxLength\s*=\s*(\d+)/.exec(attrs);

    if (nameMatch && !fieldNames.has(nameMatch[1]!)) {
      fieldNames.add(nameMatch[1]!);
      let validation = "";
      if (required) validation += "required ";
      if (patternMatch) validation += "pattern=" + patternMatch[1] + " ";
      if (maxLengthMatch) validation += "maxLength=" + maxLengthMatch[1];

      formFields.push({
        name: nameMatch[1]!,
        type: typeMatch?.[1] ?? "text",
        required,
        validation: validation.trim() || undefined,
        placeholder: placeholderMatch?.[1],
      });
    }
  }

  // <select name="..." ...>
  const selectPattern = /<select\s+([^>]*?)\s*>([\s\S]*?)<\/select>/gs;
  let selectMatch: RegExpExecArray | null;
  while ((selectMatch = selectPattern.exec(source)) !== null) {
    const attrs = selectMatch[1]!;
    const nameMatch = /name\s*=\s*["']([^"']+)["']/.exec(attrs);
    const required = /\brequired\b/.test(attrs);
    if (nameMatch && !fieldNames.has(nameMatch[1]!)) {
      fieldNames.add(nameMatch[1]!);
      const options: string[] = [];
      const optPattern = /<option[^>]*value=["']([^"']*)["']/g;
      let om: RegExpExecArray | null;
      while ((om = optPattern.exec(selectMatch[2])) !== null) {
        options.push(om[1]!);
      }
      formFields.push({
        name: nameMatch[1]!,
        type: "select",
        required,
        options: options.length > 0 ? options : undefined,
      });
    }
  }

  if (formFields.length > 0) {
    const formNameMatch = /function\s+(\w+Form)/.exec(source)
      ?? /const\s+(\w+Form)\s*=/.exec(source)
      ?? /<Form[^>]*name=["'](\w+)["']/.exec(source);
    const submitMatch = /(?:onSubmit|handleSubmit)\s*=\s*\{?\s*(\w+)\s*\}?/.exec(source);

    let submitEndpoint: string | undefined;
    let submitMethod: string | undefined;

    if (submitMatch) {
      const handlerName = submitMatch[1]!;
      const patternParts = [
        handlerName,
        "[\\s\\S]{0,500}(?:fetch|axios\\.|apiFetch)\\(\\s*[\\\"'`]([^\\\"'`]+)[\\\"'`]",
        "[\\s\\S]{0,100}(method\\s*:\\s*[\\\"'](\\w+)[\\\"'])?"
      ];
      const handlerPattern = new RegExp(patternParts.join(""), "i");
      const handlerMatch = handlerPattern.exec(source);
      if (handlerMatch) {
        submitEndpoint = handlerMatch[1]!;
        submitMethod = handlerMatch[3]?.toUpperCase() ?? "POST";
      }
    }

    forms.push({
      name: formNameMatch?.[1] ?? filePath.split("/").pop()?.replace(/\.(tsx|ts)$/, "") ?? "Form",
      file: filePath,
      type: "static",
      fields: formFields,
      submitEndpoint,
      submitMethod,
    });
  }

  // ---- Forms: dynamic (DynamicForm) ----
  const dynFormPattern = /<DynamicForm\s+([^>]*?)\/?>/gs;
  let dynMatch: RegExpExecArray | null;
  while ((dynMatch = dynFormPattern.exec(source)) !== null) {
    const attrs = dynMatch[1]!;
    const schemaMatch = /schema\s*=\s*\{?\s*(\w+)\s*\}?/.exec(attrs);
    const onSubmitMatch = /onSubmit\s*=\s*\{?\s*(\w+)\s*\}?/.exec(attrs);

    if (schemaMatch) {
      const schemaName = schemaMatch[1]!;
      const importParts = [
        "import\\s+(?:\\{[^}]*",
        schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "[^}]*\\}|",
        schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "\\s+from)\\s+from\\s+[\\\"']([^\\\"']+)[\\\"']"
      ];
      const schemaImportPattern = new RegExp(importParts.join(""), "i");
      schemaImportPattern.exec(source);

      forms.push({
        name: "DynamicForm (" + schemaName + ")",
        file: filePath,
        type: "dynamic",
        fields: [],
        submitEndpoint: undefined,
        submitMethod: onSubmitMatch ? "POST" : undefined,
      });
    }
  }

  // ---- Endpoints: fetch/axios/apiFetch calls ----
  const fetchPatternStr = "(?:fetch|axios\\.(?:get|post|put|patch|delete)|apiFetch)\\s*\\(\\s*[\\\"'`]([^\\\"'`]+)[\\\"'`][\\s\\S]{0,200}?(method\\s*:\\s*[\\\"'](\\w+)[\\\"'])?";
  const fetchPattern = new RegExp(fetchPatternStr, "gi");
  let fetchMatch: RegExpExecArray | null;
  const seenEndpoints = new Set<string>();
  while ((fetchMatch = fetchPattern.exec(source)) !== null) {
    const url = fetchMatch[1]!;
    const method = fetchMatch[3]?.toUpperCase()
      ?? (/axios\.(get)/i.test(fetchMatch[0]) ? "GET"
        : /axios\.(post)/i.test(fetchMatch[0]) ? "POST"
        : /axios\.(put)/i.test(fetchMatch[0]) ? "PUT"
        : /axios\.(patch)/i.test(fetchMatch[0]) ? "PATCH"
        : /axios\.(delete)/i.test(fetchMatch[0]) ? "DELETE"
        : "GET");
    const key = method + ":" + url;
    if (!seenEndpoints.has(key)) {
      seenEndpoints.add(key);
      endpoints.push({ method, path: url, usage: "data", file: filePath });
    }
  }

  return { subComponents, forms, endpoints };
}

// ---------------------------------------------------------------------------
// Utility: resolve relative paths
// ---------------------------------------------------------------------------

function resolveRelativePath(dir: string, importPath: string): string {
  let normalized = importPath.replace(/^\.\//, "");
  const parts = normalized.split("/");
  const dirParts = dir.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      dirParts.pop();
    } else if (part !== ".") {
      resolved.push(part);
    }
  }

  const fullPath = [...dirParts, ...resolved].join("/");
  if (!/\.[a-z]+$/i.test(fullPath)) {
    // Try common extensions
    return fullPath + ".tsx";
  }
  return fullPath;
}

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

function parseSnapshotRoutes(snapshotMarkdown: string): Map<string, RouteEntry> {
  const routes = new Map<string, RouteEntry>();
  const routeBlocks = snapshotMarkdown.split(/^##\s+/m);
  for (const block of routeBlocks) {
    const urlMatch = block.match(/^(\/\S+)/m);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    routes.set(url, {
      url,
      params: [],
      screenName: "",
      componentPath: "",
      subComponents: [],
      forms: [],
      endpoints: [],
      navigation: [],
    });
  }
  return routes;
}

export function computeDiff(
  currentRoutes: RouteEntry[],
  baselineMarkdown: string,
): RouteEntry[] {
  const baseline = parseSnapshotRoutes(baselineMarkdown);
  const currentMap = new Map(currentRoutes.map((r) => [r.url, r]));
  const result: RouteEntry[] = [];

  for (const route of currentRoutes) {
    if (!baseline.has(route.url)) {
      route.changed = "added";
      result.push(route);
    } else {
      const base = baseline.get(route.url)!;
      const changed = route.componentPath !== base.componentPath
        || JSON.stringify(route.forms) !== JSON.stringify(base.forms)
        || JSON.stringify(route.endpoints) !== JSON.stringify(base.endpoints);
      route.changed = changed ? "modified" : "unchanged";
      result.push(route);
    }
  }

  // Detect removed routes
  for (const [url] of baseline) {
    if (!currentMap.has(url)) {
      result.push({
        url,
        params: [],
        screenName: url.split("/").pop() ?? "",
        componentPath: "REMOVED",
        subComponents: [],
        forms: [],
        endpoints: [],
        navigation: [],
        changed: "removed",
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Navigation map formatting for output
// ---------------------------------------------------------------------------

export function formatNavigationMapMarkdown(map: NavigationMap, showAll?: boolean): string {
  const lines: string[] = [];
  lines.push("# Mapa de Navegacion - Proyecto: " + map.projectId);
  lines.push("");
  lines.push("> Generado: " + new Date().toISOString().slice(0, 10));
  lines.push("> Framework: " + map.framework + " " + map.frameworkVersion);
  lines.push("> Rutas: " + map.routes.length);
  lines.push("> Componentes compartidos: " + map.sharedComponents.length);
  if (map.apiClient) {
    lines.push("> apiClient: " + map.apiClient.name + " (" + map.apiClient.baseUrl + ", " + map.apiClient.method + ")");
  }
  if (Object.keys(map.pathAliases).length > 0) {
    lines.push("> Path aliases: " + Object.keys(map.pathAliases).join(", "));
  }
  lines.push("");

  if (map.errors.length > 0) {
    lines.push("## Advertencias");
    lines.push("");
    for (const err of map.errors) {
      lines.push("- ⚠️ " + err);
    }
    lines.push("");
  }

  if (map.routes.length === 0 && map.errors.length === 0) {
    lines.push("_No se encontraron rutas. Verifica que el proyecto tenga configuracion de routing._");
    lines.push("");
    return lines.join("\n");
  }

  for (const route of map.routes) {
    // In diff mode, skip unchanged routes unless showAll is true
    if (route.changed === "unchanged" && !showAll) continue;

    lines.push("---");
    lines.push("");

    const statusIcon = route.changed === "added" ? " 🟢" : route.changed === "modified" ? " 🟡" : route.changed === "removed" ? " 🔴" : "";
    lines.push("## " + route.url + statusIcon);
    lines.push("### Pantalla: " + route.screenName);
    lines.push("");
    lines.push("- **URL:** " + route.url);
    if (route.params.length > 0) {
      lines.push("- **Parametros:** " + route.params.join(", "));
    }
    if (route.changed) {
      lines.push("- **Estado:** " + route.changed);
    }
    lines.push("- **Renderiza:** " + route.componentPath);

    if (route.subComponents.length > 0) {
      lines.push("  - Subcomponentes:");
      for (const sc of route.subComponents) {
        const sharedTag = sc.isShared ? " [compartido]" : "";
        lines.push("    - " + sc.name + " (" + sc.path + ")" + sharedTag);
      }
    }

    if (route.forms.length > 0) {
      lines.push("- **Formularios:**");
      for (const form of route.forms) {
        lines.push("  - " + form.name + " (" + form.type + ")");
        if (form.fields.length > 0) {
          for (const field of form.fields) {
            const validation = field.validation ? " [" + field.validation + "]" : "";
            lines.push("    - " + field.name + " (" + field.type + ")" + validation);
          }
        }
        if (form.submitEndpoint) {
          lines.push("    - Submit: " + (form.submitMethod ?? "POST") + " " + form.submitEndpoint);
        }
      }
    }

    if (route.endpoints.length > 0) {
      lines.push("- **Endpoints:**");
      const seen = new Set<string>();
      for (const ep of route.endpoints) {
        const key = ep.method + " " + ep.path;
        if (!seen.has(key)) {
          seen.add(key);
          lines.push("  - " + ep.method + " " + ep.path);
        }
      }
    }

    lines.push("");
  }

  if (map.sharedComponents.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Componentes Compartidos");
    lines.push("");
    for (const sc of map.sharedComponents) {
      lines.push("### " + sc.name);
      lines.push("");
      lines.push("- **Archivo:** " + sc.path);
      lines.push("- **Usado en:** " + sc.usedInRoutes.length + " rutas");
      for (const url of sc.usedInRoutes) {
        lines.push("  - " + url);
      }
      lines.push("  > ⚠️ Modificar este componente afecta " + sc.usedInRoutes.length + " pantallas.");
      if (sc.endpoints && sc.endpoints.length > 0) {
        lines.push("- **Endpoints:**");
        for (const ep of sc.endpoints) {
          lines.push("  - " + ep.method + " " + ep.path);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export function serializeNavigationMapJson(map: NavigationMap): string {
  return JSON.stringify(map, null, 2);
}

/**
 * Escribe el mapa de navegacion a un archivo via la API de persistencia.
 * Como alternativa, guarda el Markdown en la base de datos de TheForge.
 */
export function navigationMapToJsonPatch(map: NavigationMap): Record<string, unknown> {
  return {
    mddContent: formatNavigationMapMarkdown(map),
    navigationMapJson: serializeNavigationMapJson(map),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main scanner function
// ---------------------------------------------------------------------------

export async function scanNavigationMap(
  projectOrRepoId: string,
  ingestBase: string,
  options?: {
    baselineSnapshot?: string;
    showAll?: boolean;
  },
): Promise<NavigationMap> {
  const errors: string[] = [];
  const routes: RouteEntry[] = [];
  const sharedComponents: SharedComponent[] = [];
  const baseUrl = ingestBase.replace(/\/$/, "");

  // 1. Read package.json
  const pkg = await readJsonFromIngest(baseUrl, projectOrRepoId, "package.json");
  if (!pkg) {
    return {
      projectId: projectOrRepoId,
      framework: "unknown",
      frameworkVersion: "0",
      routes: [],
      sharedComponents: [],
      pathAliases: {},
      errors: ["No se pudo leer package.json"],
    };
  }

  // 2. Read tsconfig.json for path aliases
  const tsconfig = await readJsonFromIngest(baseUrl, projectOrRepoId, "tsconfig.json")
    ?? await readJsonFromIngest(baseUrl, projectOrRepoId, "jsconfig.json");
  const pathAliases = resolvePathAliases(tsconfig);

  // 3. Detect apiClient
  const apiClient = await detectApiClient(baseUrl, projectOrRepoId);

  // 4. Detect framework
  const framework = detectFramework(pkg);
  let rawRoutes: Array<{ path: string; componentPath: string }> = [];

  // 5. Extract routes based on framework
  if (framework.name === "react-router-dom") {
    const routerPaths = [
      "src/router.tsx", "src/router.ts", "src/router.jsx",
      "src/routes.tsx", "src/routes.ts",
      "src/App.tsx", "src/App.jsx",
      "router.tsx", "router.ts",
      "routes.tsx", "routes.ts",
    ];
    for (const rp of routerPaths) {
      const content = await readIngestFile(baseUrl, projectOrRepoId, rp);
      if (content) {
        rawRoutes = parseReactRouterRoutes(content, rp);
        if (rawRoutes.length > 0) break;
      }
    }
  } else if (framework.name === "next") {
    // Dynamic Next.js scanner via tree API
    const pageFiles = await scanNextJsDirectories(baseUrl, projectOrRepoId);
    for (const pf of pageFiles) {
      rawRoutes.push({ path: pf.routePath, componentPath: pf.path });
    }
    if (rawRoutes.length === 0) {
      errors.push("No se encontraron rutas en pages/ ni app/ (Next.js). Verifica que existan archivos de pagina.");
    }
  } else {
    const commonPaths = [
      "src/router.tsx", "src/router.ts", "src/routes.tsx",
      "router.tsx", "routes.ts", "src/App.tsx",
    ];
    for (const rp of commonPaths) {
      const content = await readIngestFile(baseUrl, projectOrRepoId, rp);
      if (content) {
        rawRoutes = parseReactRouterRoutes(content, rp);
        if (rawRoutes.length > 0) break;
      }
    }
  }

  // 6. For each route, resolve component and analyze
  const allSubComponents: Map<string, string[]> = new Map();

  for (const rr of rawRoutes) {
    const componentPath = rr.componentPath;

    // Build search paths based on whether this is a Next.js page file or a component name
    let possiblePaths: string[];
    if (componentPath.startsWith("pages/") || componentPath.startsWith("app/")) {
      // Next.js: use the file path directly
      possiblePaths = [componentPath];
    } else {
      possiblePaths = [
        "src/pages/" + componentPath + ".tsx",
        "src/pages/" + componentPath + "/index.tsx",
        "src/components/" + componentPath + ".tsx",
        "src/" + componentPath + ".tsx",
        "pages/" + componentPath + ".tsx",
        componentPath,
      ];
    }

    let source: string | null = null;
    let resolvedPath = componentPath;

    for (const pp of possiblePaths) {
      source = await readIngestFile(baseUrl, projectOrRepoId, pp);
      if (source) {
        resolvedPath = pp;
        break;
      }
    }

    if (!source) {
      errors.push("No se encontro el componente " + componentPath + " para la ruta " + rr.path);
      continue;
    }

    const analysis = analyzeComponent(source, resolvedPath, pathAliases);

    // Track sub-components for shared detection
    for (const sc of analysis.subComponents) {
      if (!allSubComponents.has(sc.path)) {
        allSubComponents.set(sc.path, []);
      }
      const routeList = allSubComponents.get(sc.path)!;
      if (!routeList.includes(rr.path)) {
        routeList.push(rr.path);
      }
    }

    const entry: RouteEntry = {
      url: rr.path,
      params: [],
      screenName: inferScreenName(rr.path, componentPath),
      componentPath: resolvedPath,
      subComponents: analysis.subComponents,
      forms: analysis.forms,
      endpoints: analysis.endpoints,
      navigation: [],
    };

    const paramMatches = rr.path.match(/:\w+/g);
    if (paramMatches) {
      entry.params = paramMatches.map((p) => p.replace(":", ""));
    }

    routes.push(entry);
  }

  // 7. Identify shared components (used in >=2 routes)
  for (const [path, routeUrls] of allSubComponents) {
    if (routeUrls.length >= 2) {
      const source = await readIngestFile(baseUrl, projectOrRepoId, path);
      let forms: FormEntry[] = [];
      let endpoints: EndpointRef[] = [];
      if (source) {
        const analysis = analyzeComponent(source, path, pathAliases);
        forms = analysis.forms;
        endpoints = analysis.endpoints;
      }

      sharedComponents.push({
        path,
        name: path.split("/").pop()?.replace(/\.(tsx|ts|jsx|js)$/, "") ?? path,
        forms,
        endpoints,
        usedInRoutes: routeUrls,
      });
    }
  }

  // 8. Mark subcomponents as shared in each route
  const sharedPaths = new Set(sharedComponents.map((s) => s.path));
  for (const route of routes) {
    for (const sc of route.subComponents) {
      if (sharedPaths.has(sc.path)) {
        sc.isShared = true;
        sc.sharedRoutes = allSubComponents.get(sc.path);
      }
    }
  }

  const map: NavigationMap = {
    projectId: projectOrRepoId,
    framework: framework.name,
    frameworkVersion: framework.version,
    routes,
    sharedComponents,
    apiClient: apiClient ?? undefined,
    pathAliases,
    errors,
  };

  // 9. Diff mode: compute changes against baseline
  if (options?.baselineSnapshot) {
    map.routes = computeDiff(routes, options.baselineSnapshot);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Utility: infer screen name from route path
// ---------------------------------------------------------------------------

export function inferScreenName(routePath: string, _componentName: string): string {
  const parts = routePath.split("/").filter(Boolean);
  if (parts.length === 0) return "Inicio";

  const nameMap: Record<string, string> = {
    "new": "Nuevo",
    "create": "Crear",
    "edit": "Editar",
    "list": "Lista",
    "detail": "Detalle",
    "view": "Ver",
    "settings": "Configuracion",
    "profile": "Perfil",
    "login": "Iniciar Sesion",
    "register": "Registro",
    "dashboard": "Panel Principal",
    "admin": "Administracion",
    "reports": "Reportes",
    "search": "Busqueda",
  };

  const named = parts.map((p) => nameMap[p] ?? p.charAt(0).toUpperCase() + p.slice(1));
  return named.join(" - ");
}
