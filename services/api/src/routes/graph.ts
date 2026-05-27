import { Router, Request, Response } from "express";
import { getGraph, getShadowGraph } from "../falkor.js";
import {
  cacheGet,
  cacheSet,
  impactCacheKey,
  componentCacheKey,
  contractCacheKey,
  CACHE_TTL,
} from "../cache.js";

export const graphRouter = Router();

/**
 * GET /graph/impact/:nodeId
 * Qué archivos/componentes se verían afectados si se modifica el nodo (función/componente).
 */
graphRouter.get("/impact/:nodeId", async (req: Request, res: Response) => {
  const nodeId = req.params.nodeId;
  if (!nodeId) {
    return res.status(400).json({ error: "nodeId required" });
  }
  const cached = await cacheGet<{ nodeId: string; dependents: unknown[] }>(impactCacheKey(nodeId));
  if (cached) return res.json(cached);
  try {
    const graph = await getGraph();
    const q = `MATCH (n {name: $nodeName})<-[:CALLS|RENDERS*]-(dependent) RETURN dependent.name AS name, labels(dependent) AS labels`;
    const result = (await graph.query(q, { params: { nodeName: nodeId } })) as {
      headers?: string[];
      data?: unknown[][];
    };
    const data = result.data ?? [];
    const headers = result.headers ?? ["name", "labels"];
    const dependents = data.map((row: unknown) => {
      const arr = Array.isArray(row) ? row : [row];
      const nameIdx = headers.indexOf("name");
      const labelsIdx = headers.indexOf("labels");
      return {
        name: nameIdx >= 0 ? arr[nameIdx] : arr[0],
        labels: labelsIdx >= 0 ? arr[labelsIdx] : arr[1],
      };
    });
    const payload = { nodeId, dependents };
    await cacheSet(impactCacheKey(nodeId), payload, CACHE_TTL.impact);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /graph/component/:name?depth=2
 * Dependencias directas e indirectas del componente.
 */
graphRouter.get("/component/:name", async (req: Request, res: Response) => {
  const name = req.params.name;
  const depth = Math.min(10, Math.max(1, parseInt(req.query.depth as string, 10) || 2));
  if (!name) {
    return res.status(400).json({ error: "name required" });
  }
  const cached = await cacheGet<{ componentName: string; depth: number; dependencies: unknown[] }>(
    componentCacheKey(name, depth)
  );
  if (cached) return res.json(cached);
  try {
    const graph = await getGraph();
    const q = `MATCH (c:Component {name: $componentName})-[*1..${depth}]->(dependency) RETURN c, dependency`;
    const result = (await graph.query(q, { params: { componentName: name } })) as {
      headers?: string[];
      data?: unknown[][];
    };
    const data = result.data ?? [];
    const headers = result.headers ?? ["c", "dependency"];
    const depIdx = headers.indexOf("dependency");
    const seen = new Set<string>();
    const dependencies: { name?: string; path?: string }[] = [];
    for (const row of data as unknown[]) {
      const arr = Array.isArray(row) ? row : [row];
      const dep = depIdx >= 0 && arr[depIdx] != null ? arr[depIdx] : arr[1];
      const obj = dep && typeof dep === "object" ? (dep as Record<string, unknown>) : { name: String(dep) };
      const key = String(obj.name ?? obj.path ?? JSON.stringify(obj));
      if (seen.has(key)) continue;
      seen.add(key);
      dependencies.push({ name: obj.name as string, path: obj.path as string });
    }
    const payload = { componentName: name, depth, dependencies };
    await cacheSet(componentCacheKey(name, depth), payload, CACHE_TTL.component);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /graph/contract/:componentName
 * Props y firma del componente (HAS_PROP en FalkorDB).
 */
graphRouter.get("/contract/:componentName", async (req: Request, res: Response) => {
  const componentName = req.params.componentName;
  if (!componentName) {
    return res.status(400).json({ error: "componentName required" });
  }
  const cached = await cacheGet<{ componentName: string; props: { name: string; required: boolean }[] }>(
    contractCacheKey(componentName)
  );
  if (cached) return res.json(cached);
  try {
    const graph = await getGraph();
    const q = `MATCH (c:Component {name: $componentName})-[:HAS_PROP]->(p:Prop) RETURN p.name AS name, p.required AS required`;
    const result = (await graph.query(q, { params: { componentName } })) as {
      headers?: string[];
      data?: unknown[][];
    };
    const data = result.data ?? [];
    const headers = result.headers ?? ["name", "required"];
    const nameIdx = headers.indexOf("name");
    const requiredIdx = headers.indexOf("required");
    const props = data.map((row: unknown) => {
      const arr = Array.isArray(row) ? row : [row];
      return {
        name: (nameIdx >= 0 ? arr[nameIdx] : arr[0]) as string,
        required: requiredIdx >= 0 ? arr[requiredIdx] === true || arr[requiredIdx] === "true" : false,
      };
    });
    const payload = { componentName, props };
    await cacheSet(contractCacheKey(componentName), payload, CACHE_TTL.contract);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function getPropsForComponent(
  graph: Awaited<ReturnType<typeof getGraph>>,
  componentName: string
): Promise<{ name: string; required: boolean }[]> {
  const q = `MATCH (c:Component {name: $componentName})-[:HAS_PROP]->(p:Prop) RETURN p.name AS name, p.required AS required`;
  const result = (await graph.query(q, { params: { componentName } })) as {
    headers?: string[];
    data?: unknown[][];
  };
  const data = result.data ?? [];
  const headers = result.headers ?? ["name", "required"];
  const nameIdx = headers.indexOf("name");
  const requiredIdx = headers.indexOf("required");
  return data.map((row: unknown) => {
    const arr = Array.isArray(row) ? row : [row];
    return {
      name: (nameIdx >= 0 ? arr[nameIdx] : arr[0]) as string,
      required: requiredIdx >= 0 ? arr[requiredIdx] === true || arr[requiredIdx] === "true" : false,
    };
  });
}

/**
 * GET /graph/compare/:componentName
 * Comparación multi-dimensional: props, relaciones, dependencias, funciones e impacto en dependientes
 * del grafo principal vs shadow (tras indexar código propuesto).
 */
graphRouter.get("/compare/:componentName", async (req: Request, res: Response) => {
  const componentName = req.params.componentName;
  if (!componentName) {
    return res.status(400).json({ error: "componentName required" });
  }
  const shadowSessionId =
    typeof req.query.shadowSessionId === "string" ? req.query.shadowSessionId.trim() : "";
  try {
    const [mainGraph, shadowGraph] = await Promise.all([
      getGraph(),
      getShadowGraph(shadowSessionId || undefined),
    ]);

    // Helpers
    const queryNamed = async (
      g: Awaited<ReturnType<typeof getGraph>>,
      cypher: string,
      params: Record<string, string> = {},
    ): Promise<{ name: string }[]> => {
      const r = await g.query(cypher, { params }) as {
        headers?: string[];
        data?: unknown[][];
      };
      const data = r.data ?? [];
      const headers = r.headers ?? [];
      const nameIdx = headers.length ? headers.indexOf("name") : -1;
      return data
        .map((row: unknown) => {
          const arr = Array.isArray(row) ? row : [row];
          return { name: String(nameIdx >= 0 ? arr[nameIdx] ?? "" : arr[0] ?? "") };
        })
        .filter((x) => x.name);
    };

    const diffNamed = <T extends { name: string }>(main: T[], shadow: T[]) => {
      const mSet = new Set(main.map((p) => p.name));
      const sSet = new Set(shadow.map((p) => p.name));
      const missing = main.filter((p) => !sSet.has(p.name)).map((p) => p.name);
      const extra = shadow.filter((p) => !mSet.has(p.name)).map((p) => p.name);
      return { match: missing.length === 0 && extra.length === 0, main, shadow, missing, extra };
    };

    // 1. Props
    const [mainProps, shadowProps] = await Promise.all([
      getPropsForComponent(mainGraph, componentName),
      getPropsForComponent(shadowGraph, componentName),
    ]);
    const propsChanged: { name: string; main: { required: boolean }; shadow: { required: boolean } }[] = [];
    const spMap = new Map(shadowProps.map((p) => [p.name, p]));
    for (const mp of mainProps) {
      const sp = spMap.get(mp.name);
      if (sp && sp.required !== mp.required) {
        propsChanged.push({ name: mp.name, main: { required: mp.required }, shadow: { required: sp.required } });
      }
    }

    // 2. Relations (renders + hooks)
    const [mainRenders, shadowRenders, mainHooks, shadowHooks] = await Promise.all([
      queryNamed(mainGraph,
        `MATCH (c:Component {name: $name})-[:RENDERS]->(child:Component) RETURN child.name AS name`,
        { name: componentName }),
      queryNamed(shadowGraph,
        `MATCH (c:Component {name: $name})-[:RENDERS]->(child:Component) RETURN child.name AS name`,
        { name: componentName }),
      queryNamed(mainGraph,
        `MATCH (c:Component {name: $name})-[:USES_HOOK]->(h:Hook) RETURN h.name AS name`,
        { name: componentName }),
      queryNamed(shadowGraph,
        `MATCH (c:Component {name: $name})-[:USES_HOOK]->(h:Hook) RETURN h.name AS name`,
        { name: componentName }),
    ]);

    // 3. Dependencies (imports + cross-file calls)
    const [mainImports, shadowImports, mainCalls, shadowCalls] = await Promise.all([
      queryNamed(mainGraph,
        `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:IMPORTS]->(imp:File) RETURN imp.path AS name`,
        { name: componentName }),
      queryNamed(shadowGraph,
        `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:IMPORTS]->(imp:File) RETURN imp.path AS name`,
        { name: componentName }),
      queryNamed(mainGraph,
        `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:CONTAINS]->(fn:Function)-[:CALLS]->(callee:Function) WHERE NOT EXISTS(callee.path) OR callee.path <> f.path RETURN DISTINCT callee.path + '::' + callee.name AS name`,
        { name: componentName }),
      queryNamed(shadowGraph,
        `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:CONTAINS]->(fn:Function)-[:CALLS]->(callee:Function) WHERE NOT EXISTS(callee.path) OR callee.path <> f.path RETURN DISTINCT callee.path + '::' + callee.name AS name`,
        { name: componentName }),
    ]);

    // 4. Functions
    const [mainFuncs, shadowFuncs] = await Promise.all([
      (async () => {
        const r = await mainGraph.query(
          `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:CONTAINS]->(fn:Function) RETURN fn.name AS name, fn.startLine AS startLine, fn.endLine AS endLine`,
          { params: { name: componentName } },
        ) as { headers?: string[]; data?: unknown[][] };
        const data = r.data ?? [];
        const headers = r.headers ?? [];
        const ni = headers.indexOf("name");
        const si = headers.indexOf("startLine");
        const ei = headers.indexOf("endLine");
        return data.map((row: unknown) => {
          const arr = Array.isArray(row) ? row : [row];
          const sl = si >= 0 ? Number(arr[si]) : undefined;
          const el = ei >= 0 ? Number(arr[ei]) : undefined;
          return {
            name: String(ni >= 0 ? arr[ni] ?? "" : arr[0] ?? ""),
            startLine: Number.isFinite(sl) ? sl : undefined,
            endLine: Number.isFinite(el) ? el : undefined,
          };
        }).filter((x) => x.name);
      })(),
      (async () => {
        const r = await shadowGraph.query(
          `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $name}) MATCH (f)-[:CONTAINS]->(fn:Function) RETURN fn.name AS name, fn.startLine AS startLine, fn.endLine AS endLine`,
          { params: { name: componentName } },
        ) as { headers?: string[]; data?: unknown[][] };
        const data = r.data ?? [];
        const headers = r.headers ?? [];
        const ni = headers.indexOf("name");
        const si = headers.indexOf("startLine");
        const ei = headers.indexOf("endLine");
        return data.map((row: unknown) => {
          const arr = Array.isArray(row) ? row : [row];
          const sl = si >= 0 ? Number(arr[si]) : undefined;
          const el = ei >= 0 ? Number(arr[ei]) : undefined;
          return {
            name: String(ni >= 0 ? arr[ni] ?? "" : arr[0] ?? ""),
            startLine: Number.isFinite(sl) ? sl : undefined,
            endLine: Number.isFinite(el) ? el : undefined,
          };
        }).filter((x) => x.name);
      })(),
    ]);
    const funcsChanged: { name: string; linesChanged: boolean }[] = [];
    const sfMap = new Map(shadowFuncs.map((f) => [f.name, f]));
    for (const mf of mainFuncs) {
      const sf = sfMap.get(mf.name);
      if (sf && (mf.startLine !== sf.startLine || mf.endLine !== sf.endLine)) {
        funcsChanged.push({ name: mf.name, linesChanged: true });
      }
    }

    // 5. Dependents impact
    const dependents = await queryNamed(mainGraph,
      `MATCH (dep:Component)-[:RENDERS]->(c:Component {name: $name}) RETURN dep.name AS name`,
      { name: componentName },
    );
    const spNames = new Set(shadowProps.map((p) => p.name));
    const mainRequired = new Set(mainProps.filter((p) => p.required).map((p) => p.name));
    const breakingDetails: Record<string, { missingProps: string[]; newlyRequired: string[]; removedInShadow: string[] }> = {};
    for (const dep of dependents) {
      const missing = mainProps.filter((p) => p.required && !spNames.has(p.name)).map((p) => p.name);
      const newReq = shadowProps.filter((p) => p.required && !mainRequired.has(p.name)).map((p) => p.name);
      const removed = mainProps.filter((p) => !spNames.has(p.name)).map((p) => p.name);
      if (missing.length || newReq.length || removed.length) {
        breakingDetails[dep.name] = { missingProps: missing, newlyRequired: newReq, removedInShadow: removed };
      }
    }

    // Assemble
    const propsDiff = diffNamed(mainProps, shadowProps);
    const allChecks = [
      propsDiff.match,
      ...["renders", "usesHook"].map(() => true), // computed below
      ...["imports", "crossFileCalls"].map(() => true),
      true, // functions
      Object.keys(breakingDetails).length === 0,
    ];

    const rendersDiff = diffNamed(mainRenders, shadowRenders);
    const hooksDiff = diffNamed(mainHooks, shadowHooks);
    const importsDiff = diffNamed(mainImports, shadowImports);
    const callsDiff = diffNamed(mainCalls, shadowCalls);
    const funcsDiff = diffNamed(mainFuncs, shadowFuncs);

    const allMatch = [
      propsDiff.match, rendersDiff.match, hooksDiff.match,
      importsDiff.match, callsDiff.match, funcsDiff.match,
      Object.keys(breakingDetails).length === 0,
    ].every(Boolean);

    res.json({
      componentName,
      match: allMatch,
      verdict: allMatch ? "approved" : "breaking_changes",
      props: { ...propsDiff, changed: propsChanged },
      relations: { renders: rendersDiff, usesHook: hooksDiff },
      dependencies: { imports: importsDiff, crossFileCalls: callsDiff },
      functions: { ...funcsDiff, changed: funcsChanged },
      dependentsImpact: {
        affected: dependents.map((d) => d.name),
        breakingFor: Object.keys(breakingDetails),
        details: breakingDetails,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/** Shadow indexing: microservicio ingest (POST /shadow). */
const SHADOW_URL = process.env.INGEST_URL ?? "http://ingest:3002";

/**
 * POST /graph/shadow
 * Proxy a Ingest: indexa archivos en grafo shadow por sesión (FalkorSpecsShadow:<id>).
 * Body: { files: [{ path, content }], shadowSessionId?: string }.
 */
graphRouter.post("/shadow", async (req: Request, res: Response) => {
  const body = req.body as {
    files?: { path: string; content: string }[];
    shadowSessionId?: string;
  };
  if (!body?.files || !Array.isArray(body.files)) {
    return res.status(400).json({ error: "body.files array required" });
  }
  try {
    const r = await fetch(`${SHADOW_URL}/shadow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: body.files,
        ...(body.shadowSessionId?.trim() ? { shadowSessionId: body.shadowSessionId.trim() } : {}),
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Re-export for consumers that need the base URL
export { SHADOW_URL };
