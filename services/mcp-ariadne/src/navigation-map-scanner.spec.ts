/**
 * @fileoverview Tests del Navigation Map Scanner.
 * Usa node:test (nativo desde Node 18+) — no requiere dependencias externas.
 *
 * Ejecutar: node --experimental-strip-types --test services/mcp-ariadne/src/navigation-map-scanner.spec.ts
 * O: npx tsx --test services/mcp-ariadne/src/navigation-map-scanner.spec.ts
 */
import { describe, it } from "node:test";
import * as assert from "node:assert";

// ---------------------------------------------------------------------------
// Helper: load scanner functions
// ---------------------------------------------------------------------------

async function loadScanner() {
  // In Node 22 with --experimental-strip-types this works for relative imports
  return await import("./navigation-map-scanner.ts");
}

// ---------------------------------------------------------------------------
// detectFramework
// ---------------------------------------------------------------------------

describe("detectFramework", () => {
  it("detects react-router-dom", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "react-router-dom": "^7.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "react-router-dom");
    assert.equal(result.routePattern, "object");
  });

  it("detects next.js", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { next: "^15.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "next");
    assert.equal(result.routePattern, "filesystem");
  });

  it("detects tanstack-router", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "@tanstack/react-router": "^1.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "tanstack-router");
  });

  it("detects angular", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "@angular/router": "^18.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "angular");
  });

  it("detects vue-router", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "vue-router": "^4.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "vue-router");
  });

  it("detects sveltekit", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "@sveltejs/kit": "^2.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "sveltekit");
  });

  it("detects expo-router", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "expo-router": "^4.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "expo-router");
  });

  it("detects remix", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { "@remix-run/react": "^2.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "remix");
  });

  it("detects devDependencies", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { devDependencies: { next: "^15.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "next");
  });

  it("returns unknown when no framework found", async () => {
    const { detectFramework } = await loadScanner();
    const pkg = { dependencies: { lodash: "^4.0.0" } };
    const result = detectFramework(pkg as any);
    assert.equal(result.name, "unknown");
  });
});

// ---------------------------------------------------------------------------
// parseReactRouterRoutes
// ---------------------------------------------------------------------------

describe("parseReactRouterRoutes", () => {
  it("uses external component names from element prop", async () => {
    const { parseReactRouterRoutes } = await loadScanner();
    const content = `
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductsList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
      </Routes>
    `;
    const routes = parseReactRouterRoutes(content, "App.tsx");
    assert.equal(routes.length, 3);
    assert.equal(routes[0].path, "/");
    assert.equal(routes[0].componentPath, "Home");
    assert.equal(routes[1].path, "/products");
    assert.equal(routes[1].componentPath, "ProductsList");
    assert.equal(routes[2].path, "/products/:id");
    assert.equal(routes[2].componentPath, "ProductDetail");
  });
  it("parses JSX Route elements", async () => {
    const { parseReactRouterRoutes } = await loadScanner();
    const content = `
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductsList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
      </Routes>
    `;
    const routes = parseReactRouterRoutes(content, "App.tsx");
    assert.equal(routes.length, 3);
    assert.equal(routes[0].path, "/");
    assert.equal(routes[1].path, "/products");
    assert.equal(routes[2].path, "/products/:id");
  });

  it("deduplicates routes", async () => {
    const { parseReactRouterRoutes } = await loadScanner();
    const content = `
      createBrowserRouter([
        { path: "/", element: <Home /> },
        { path: "/", element: <Home /> },
      ])
    `;
    const routes = parseReactRouterRoutes(content, "router.tsx");
    assert.equal(routes.length, 1);
  });

  it("returns empty array for no routes", async () => {
    const { parseReactRouterRoutes } = await loadScanner();
    const routes = parseReactRouterRoutes("const x = 1;", "empty.ts");
    assert.equal(routes.length, 0);
  });
});

// ---------------------------------------------------------------------------
// resolvePathAliases
// ---------------------------------------------------------------------------

describe("resolvePathAliases", () => {
  it("extracts path aliases from tsconfig", async () => {
    const { resolvePathAliases } = await loadScanner();
    const tsconfig = {
      compilerOptions: {
        paths: {
          "@/*": ["src/*"],
          "~/components/*": ["src/components/*"],
        },
      },
    };
    const aliases = resolvePathAliases(tsconfig as any);
    assert.equal(aliases["@/"], "src/");
    assert.equal(aliases["~/components/"], "src/components/");
  });

  it("returns empty object when no paths defined", async () => {
    const { resolvePathAliases } = await loadScanner();
    const aliases = resolvePathAliases({ compilerOptions: {} } as any);
    assert.equal(Object.keys(aliases).length, 0);
  });

  it("returns empty object when no tsconfig", async () => {
    const { resolvePathAliases } = await loadScanner();
    const aliases = resolvePathAliases(null);
    assert.equal(Object.keys(aliases).length, 0);
  });
});

// ---------------------------------------------------------------------------
// resolveAliasedPath
// ---------------------------------------------------------------------------

describe("resolveAliasedPath", () => {
  it("resolves @/ prefix to src/", async () => {
    const { resolveAliasedPath } = await loadScanner();
    const aliases = { "@/": "src/" };
    const result = resolveAliasedPath("@/components/Button", aliases);
    assert.equal(result, "src/components/Button.tsx");
  });

  it("returns null for unmatched alias", async () => {
    const { resolveAliasedPath } = await loadScanner();
    const aliases = { "@/": "src/" };
    const result = resolveAliasedPath("lodash", aliases);
    assert.equal(result, null);
  });

  it("preserves file extensions", async () => {
    const { resolveAliasedPath } = await loadScanner();
    const aliases = { "@utils/": "src/utils/" };
    const result = resolveAliasedPath("@utils/formatDate.ts", aliases);
    assert.equal(result, "src/utils/formatDate.ts");
  });
});

// ---------------------------------------------------------------------------
// filesystemPathToRoute
// ---------------------------------------------------------------------------

describe("filesystemPathToRoute", () => {
  it("converts pages/dashboard.tsx to /dashboard", async () => {
    const { filesystemPathToRoute } = await loadScanner();
    assert.equal(filesystemPathToRoute("pages/dashboard.tsx"), "/dashboard");
  });

  it("converts pages/index.tsx to /", async () => {
    const { filesystemPathToRoute } = await loadScanner();
    assert.equal(filesystemPathToRoute("pages/index.tsx"), "/");
  });

  it("converts pages/blog/[slug].tsx to /blog/:slug", async () => {
    const { filesystemPathToRoute } = await loadScanner();
    assert.equal(filesystemPathToRoute("pages/blog/[slug].tsx"), "/blog/:slug");
  });

  it("converts app/dashboard/page.tsx to /dashboard", async () => {
    const { filesystemPathToRoute } = await loadScanner();
    // The app/ prefix is stripped before calling this
    assert.equal(filesystemPathToRoute("dashboard/page.tsx"), "/dashboard");
  });

  it("converts nested catch-all routes", async () => {
    const { filesystemPathToRoute } = await loadScanner();
    assert.equal(filesystemPathToRoute("pages/[...params].tsx"), "/:...params");
  });
});

// ---------------------------------------------------------------------------
// inferScreenName
// ---------------------------------------------------------------------------

describe("inferScreenName", () => {
  it("maps / to Inicio", async () => {
    const { inferScreenName } = await loadScanner();
    assert.equal(inferScreenName("/", "Home"), "Inicio");
  });

  it("maps /dashboard to Panel Principal", async () => {
    const { inferScreenName } = await loadScanner();
    assert.equal(inferScreenName("/dashboard", "Dashboard"), "Panel Principal");
  });

  it("maps /login to Iniciar Sesion", async () => {
    const { inferScreenName } = await loadScanner();
    assert.equal(inferScreenName("/login", "Login"), "Iniciar Sesion");
  });

  it("capitalizes unknown path segments", async () => {
    const { inferScreenName } = await loadScanner();
    assert.equal(inferScreenName("/custom-page", "CustomPage"), "Custom-page");
  });

  it("combines multi-segment paths", async () => {
    const { inferScreenName } = await loadScanner();
    assert.equal(inferScreenName("/admin/users", "AdminUsers"), "Administracion - Users");
  });
});

// ---------------------------------------------------------------------------
// analyzeComponent — forms
// ---------------------------------------------------------------------------

describe("analyzeComponent (forms)", () => {
  it("detects static form with inputs", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      function LoginForm() {
        return (
          <form onSubmit={handleSubmit}>
            <input name="email" type="email" required placeholder="Email" />
            <input name="password" type="password" required />
            <button type="submit">Login</button>
          </form>
        );
      }
    `;
    const result = analyzeComponent(source, "src/pages/Login.tsx", {});
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].name, "LoginForm");
    assert.equal(result.forms[0].type, "static");
    assert.equal(result.forms[0].fields.length, 2);
    assert.equal(result.forms[0].fields[0].name, "email");
    assert.equal(result.forms[0].fields[0].type, "email");
    assert.equal(result.forms[0].fields[0].required, true);
    assert.equal(result.forms[0].fields[0].placeholder, "Email");
  });

  it("detects select fields with options", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      function FilterForm() {
        return (
          <form>
            <select name="category" required>
              <option value="">All</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
            </select>
          </form>
        );
      }
    `;
    const result = analyzeComponent(source, "src/components/FilterForm.tsx", {});
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].fields.length, 1);
    assert.equal(result.forms[0].fields[0].name, "category");
    assert.equal(result.forms[0].fields[0].type, "select");
    assert.equal(result.forms[0].fields[0].required, true);
    assert.deepEqual(result.forms[0].fields[0].options, ["", "electronics", "clothing"]);
  });

  it("detects DynamicForm with schema", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      import { userSchema } from "../schemas/user";
      function UserPage() {
        return <DynamicForm schema={userSchema} onSubmit={handleSubmit} />;
      }
    `;
    const result = analyzeComponent(source, "src/pages/User.tsx", {});
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].type, "dynamic");
    assert.ok(result.forms[0].name.includes("userSchema"));
  });

  it("does not duplicate field names", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      <form>
        <input name="email" type="text" />
        <input name="email" type="text" />
      </form>
    `;
    const result = analyzeComponent(source, "src/pages/Dupe.tsx", {});
    // Should only have 1 form with 1 field (deduped)
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].fields.length, 1);
  });
});

// ---------------------------------------------------------------------------
// analyzeComponent — endpoints
// ---------------------------------------------------------------------------

describe("analyzeComponent (endpoints)", () => {
  it("detects fetch calls", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      useEffect(() => {
        fetch("/api/users");
      }, []);
    `;
    const result = analyzeComponent(source, "src/pages/Users.tsx", {});
    assert.equal(result.endpoints.length, 1);
    assert.equal(result.endpoints[0].method, "GET");
    assert.equal(result.endpoints[0].path, "/api/users");
  });

  it("detects axios calls with method inference", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      axios.post("/api/users", { name: "John" });
      axios.get("/api/users/123");
    `;
    const result = analyzeComponent(source, "src/pages/Users.tsx", {});
    assert.equal(result.endpoints.length, 2);
    assert.equal(result.endpoints[0].method, "POST");
    assert.equal(result.endpoints[0].path, "/api/users");
    assert.equal(result.endpoints[1].method, "GET");
    assert.equal(result.endpoints[1].path, "/api/users/123");
  });

  it("detects apiFetch calls", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `apiFetch("/api/products")`;
    const result = analyzeComponent(source, "src/pages/Products.tsx", {});
    assert.equal(result.endpoints.length, 1);
    assert.equal(result.endpoints[0].path, "/api/products");
  });
});

// ---------------------------------------------------------------------------
// analyzeComponent — subcomponents
// ---------------------------------------------------------------------------

describe("analyzeComponent (subcomponents)", () => {
  it("detects local imports", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      import Header from "../components/Header";
      import { Sidebar } from "../components/Sidebar";
      function Dashboard() { return <><Header /><Sidebar /></>; }
    `;
    const result = analyzeComponent(source, "src/pages/Dashboard.tsx", {});
    assert.equal(result.subComponents.length, 2);
    assert.ok(result.subComponents.some((s) => s.name === "Header"));
    assert.ok(result.subComponents.some((s) => s.name === "Sidebar"));
  });

  it("resolves relative paths correctly", async () => {
    const { analyzeComponent } = await loadScanner();
    const source = `
      import Button from "./Button";
      function Page() { return <Button />; }
    `;
    const result = analyzeComponent(source, "src/pages/Home.tsx", {});
    assert.equal(result.subComponents.length, 1);
    assert.equal(result.subComponents[0].path, "src/pages/Button.tsx");
  });
});

// ---------------------------------------------------------------------------
// formatNavigationMapMarkdown
// ---------------------------------------------------------------------------

describe("formatNavigationMapMarkdown", () => {
  it("formats a basic navigation map", async () => {
    const { formatNavigationMapMarkdown } = await loadScanner();
    const map = {
      projectId: "test-proj",
      framework: "react-router-dom",
      frameworkVersion: "7.0.0",
      routes: [
        {
          url: "/",
          params: [],
          screenName: "Inicio",
          componentPath: "src/pages/Home.tsx",
          subComponents: [{ path: "src/components/Header.tsx", name: "Header", isShared: false }],
          forms: [],
          endpoints: [{ method: "GET", path: "/api/data", usage: "data", file: "src/pages/Home.tsx" }],
          navigation: [],
        },
        {
          url: "/login",
          params: [],
          screenName: "Iniciar Sesion",
          componentPath: "src/pages/Login.tsx",
          subComponents: [],
          forms: [{
            name: "LoginForm",
            file: "src/pages/Login.tsx",
            type: "static" as const,
            fields: [{ name: "email", type: "email", required: true }],
          }],
          endpoints: [],
          navigation: [],
        },
      ],
      sharedComponents: [],
      pathAliases: { "@/": "src/" },
      errors: [],
    };
    const md = formatNavigationMapMarkdown(map as any);
    assert.ok(md.includes("Mapa de Navegacion"));
    assert.ok(md.includes("test-proj"));
    assert.ok(md.includes("Inicio"));
    assert.ok(md.includes("GET /api/data"));
    assert.ok(md.includes("LoginForm"));
    assert.ok(md.includes("email"));
    assert.ok(md.includes("Path aliases"));
  });

  it("includes diff icons when present", async () => {
    const { formatNavigationMapMarkdown } = await loadScanner();
    const map = {
      projectId: "test",
      framework: "react",
      frameworkVersion: "18",
      routes: [
        {
          url: "/new-route",
          params: [],
          screenName: "Nuevo",
          componentPath: "NewPage.tsx",
          subComponents: [],
          forms: [],
          endpoints: [],
          navigation: [],
          changed: "added" as const,
        },
      ],
      sharedComponents: [],
      pathAliases: {},
      errors: [],
    };
    const md = formatNavigationMapMarkdown(map as any);
    assert.ok(md.includes("🟢"));
  });

  it("shows warnings when errors exist", async () => {
    const { formatNavigationMapMarkdown } = await loadScanner();
    const map = {
      projectId: "test",
      framework: "react",
      frameworkVersion: "18",
      routes: [],
      sharedComponents: [],
      pathAliases: {},
      errors: ["No se pudo leer package.json"],
    };
    const md = formatNavigationMapMarkdown(map as any);
    assert.ok(md.includes("Advertencias"));
    assert.ok(md.includes("No se pudo leer package.json"));
  });
});

// ---------------------------------------------------------------------------
// computeDiff
// ---------------------------------------------------------------------------

describe("computeDiff", () => {
  it("detects added routes", async () => {
    const { computeDiff } = await loadScanner();
    const current = [
      {
        url: "/new",
        params: [],
        screenName: "Nuevo",
        componentPath: "New.tsx",
        subComponents: [],
        forms: [],
        endpoints: [],
        navigation: [],
      },
    ];
    const baseline = `## /\n/`;
    const result = computeDiff(current as any[], baseline);
    const added = result.find((r) => r.changed === "added");
    assert.ok(added);
    assert.equal(added?.url, "/new");
  });

  it("detects removed routes", async () => {
    const { computeDiff } = await loadScanner();
    const current = [] as any[];
    const baseline = `## /old\n/old`;
    const result = computeDiff(current, baseline);
    const removed = result.find((r) => r.changed === "removed");
    assert.ok(removed);
    assert.equal(removed?.url, "/old");
  });

  it("marks existing routes as modified (snapshot parser is URL-only)", async () => {
    const { computeDiff } = await loadScanner();
    const route = {
      url: "/same",
      params: [],
      screenName: "Same",
      componentPath: "Same.tsx",
      subComponents: [],
      forms: [],
      endpoints: [],
      navigation: [],
    };
    const current = [route];
    const baseline = ["## /same", "- **URL:** /same", "",].join("\n");
    const result = computeDiff(current as any[], baseline);
    // parseSnapshotRoutes only extracts URL, not componentPath,
    // so the route appears as "modified" (baseline has "" vs current "Same.tsx")
    const modified = result.find((r) => r.changed === "modified");
    assert.ok(modified, "Expected /same to be marked modified. Results: " + JSON.stringify(result.map(r => ({ url: r.url, changed: r.changed }))));
    assert.equal(modified?.url, "/same");
  });
});
