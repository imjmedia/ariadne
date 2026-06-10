/**
 * @fileoverview Servicio de consultas al grafo FalkorDB: impacto, componente, contrato, compare (API).
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isProjectShardingEnabled } from 'ariadne-common';
import { FalkorService } from '../falkor.service';
import { CacheService } from '../cache.service';

interface FalkorResult {
  headers?: string[];
  data?: unknown[][];
}

/** Instancia de grafo Falkor (misma forma para getGraph y selectGraphByLogicalName). */
type FalkorGraph = Awaited<ReturnType<FalkorService['getGraph']>>;

/** Acumulador al fusionar cortes de varios subgrafos (sharding por dominio). */
interface ComponentShardAccum {
  seenDepKeys: Set<string>;
  dependencies: { name?: string; path?: string }[];
  nodes: Map<string, GraphNodeDto>;
  edgeKey: Set<string>;
  edges: GraphEdgeDto[];
  centerId: string | null;
}

export interface GraphNodeDto {
  id: string;
  kind: string;
  name?: string;
  path?: string;
  /** Copiados del grafo Falkor (ingest) — forman parte del id para evitar colisiones multi-repo. */
  projectId?: string;
  repoId?: string;
}

export interface GraphEdgeDto {
  source: string;
  target: string;
  kind: string;
}

/** Pistas cuando el corte Falkor no muestra depends salientes (p. ej. desincronización con el chat). */
export interface GraphComponentHintsDto {
  suggestResync?: boolean;
  messageEs?: string;
}

/**
 * FalkorDB / drivers a veces devuelven `name` u otros campos como objetos anidados;
 * `String(obj)` produce "[object Object]" y rompe ids + aristas en el cliente.
 */
function falkorScalarToString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length ? t : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => falkorScalarToString(v)).filter((s): s is string => Boolean(s));
    return parts.length ? parts.join(', ') : undefined;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of ['name', 'path', 'id', 'title', 'label', 'value']) {
      const s = falkorScalarToString(o[k]);
      if (s) return s;
    }
    try {
      const j = JSON.stringify(value);
      return j.length > 200 ? j.slice(0, 197) + '…' : j;
    } catch {
      return undefined;
    }
  }
  return String(value);
}

/** Id estable por nodo: multi-repo puede repetir `name`; sin projectId/repoId colisionan en React Flow. */
function graphNodeKey(parts: {
  kind: string;
  projectId?: string;
  repoId?: string;
  path?: string;
  name?: string;
}): string {
  const kind = parts.kind;
  const projectId = parts.projectId ?? '';
  const repoId = parts.repoId ?? '';
  const path = parts.path ?? '';
  const name = parts.name ?? '';
  return `${kind}|${projectId}|${repoId}|${path}|${name}`;
}

function parseGraphNodeCell(cell: unknown): GraphNodeDto | null {
  if (cell == null) return null;
  let labels: string[] = ['Node'];
  let props: Record<string, unknown> = {};
  if (Array.isArray(cell) && cell.length >= 2 && typeof cell[1] === 'object' && cell[1] !== null) {
    const lbl = cell[0];
    labels = Array.isArray(lbl) ? lbl.map(String) : typeof lbl === 'string' ? [lbl] : ['Node'];
    props = cell[1] as Record<string, unknown>;
  } else if (typeof cell === 'object' && !Array.isArray(cell)) {
    const o = cell as Record<string, unknown>;
    const lr = o.labels ?? o.label;
    labels = Array.isArray(lr) ? lr.map(String) : lr != null ? [String(lr)] : ['Node'];
    props = { ...o };
    delete props.labels;
    delete props.label;
    const nested = o.properties;
    if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(props, nested as Record<string, unknown>);
    }
  } else {
    return null;
  }
  const kind = labels[0] ?? 'Node';
  const name =
    falkorScalarToString(props.name) ??
    falkorScalarToString(props.componentName) ??
    falkorScalarToString(props.component) ??
    falkorScalarToString((props as { displayName?: unknown }).displayName);
  const path = falkorScalarToString(props.path);
  const projectId = falkorScalarToString((props as { projectId?: unknown }).projectId);
  const repoId = falkorScalarToString((props as { repoId?: unknown }).repoId);
  const id = graphNodeKey({ kind, projectId, repoId, path, name });
  return { id, kind, name, path, projectId, repoId };
}

/** Corrige nodo foco mal parseado (label Node, sin name) y alinea con el nombre pedido al API. */
function normalizeComponentGraphFocal(
  nodes: Map<string, GraphNodeDto>,
  edges: GraphEdgeDto[],
  componentName: string,
  centerIdHint: string | null,
): void {
  const legacyTargets = [
    ...new Set(edges.filter((e) => e.kind === 'legacy_impact').map((e) => e.target)),
  ];
  let focalId: string | null = null;
  if (legacyTargets.length === 1) focalId = legacyTargets[0]!;
  else if (centerIdHint && nodes.has(centerIdHint)) focalId = centerIdHint;
  if (!focalId) {
    for (const [id, n] of nodes) {
      if (n.name === componentName) {
        focalId = id;
        break;
      }
    }
  }
  if (!focalId || !nodes.has(focalId)) return;
  const n = nodes.get(focalId)!;
  const replaceName =
    !n.name || n.name === 'unknown' || n.name === 'Node' || n.kind === 'Node';
  const kindNorm =
    n.kind === 'Node'
      ? componentName.startsWith('use')
        ? 'Hook'
        : 'Component'
      : n.kind;
  nodes.set(focalId, {
    ...n,
    name: replaceName ? componentName : n.name,
    kind: kindNorm,
  });
}

function impactNode(name: unknown, labels: unknown, projectId?: string): GraphNodeDto {
  const labelArr = Array.isArray(labels) ? labels : labels != null ? [labels] : [];
  const kindRaw = labelArr.length ? labelArr[0] : 'Node';
  const kind = falkorScalarToString(kindRaw) ?? 'Node';
  const n = falkorScalarToString(name) ?? 'unknown';
  const pid = projectId ?? '';
  const id = graphNodeKey({ kind, projectId: pid, name: n });
  return { id, kind, name: n, ...(projectId ? { projectId } : {}) };
}

function addGraphEdge(
  edges: GraphEdgeDto[],
  edgeKey: Set<string>,
  source: string,
  target: string,
  kind: GraphEdgeDto['kind'],
): void {
  if (source === target) return;
  const ek = `${source}|${target}|${kind}`;
  if (edgeKey.has(ek)) return;
  edgeKey.add(ek);
  edges.push({ source, target, kind });
}

/**
 * Falkor a veces devuelve `headers: []` y cada fila como `{ c: node, dependency: node }` o envuelta en `[[{...}]]`.
 * Sin esto, el código asumía `[a,b]` posicional y `arr[1]` quedaba undefined → sin aristas en getComponentGraph.
 */
function extractFalkorRowCells(
  row: unknown,
  keys: string[],
  headers: string[],
): unknown[] {
  let r: unknown = row;
  if (Array.isArray(r) && r.length === 1) {
    const only = r[0];
    if (only != null && typeof only === 'object' && !Array.isArray(only)) {
      const o = only as Record<string, unknown>;
      if (keys.some((k) => k in o)) r = only;
    }
  }
  if (r != null && typeof r === 'object' && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    if (keys.some((k) => k in o)) {
      return keys.map((k) => o[k]);
    }
  }
  const arr = Array.isArray(r) ? r : [r];
  return keys.map((k, i) => {
    const idx = headers.length ? headers.indexOf(k) : -1;
    return idx >= 0 ? arr[idx] : arr[i];
  });
}

function extractFalkorTwoColumnRow(
  row: unknown,
  colA: string,
  colB: string,
  headers: string[],
): [unknown, unknown] {
  const ia = headers.length ? headers.indexOf(colA) : -1;
  const ib = headers.length ? headers.indexOf(colB) : -1;
  let r: unknown = row;
  if (Array.isArray(r) && r.length === 1) {
    const only = r[0];
    if (only != null && typeof only === 'object' && !Array.isArray(only)) {
      const o = only as Record<string, unknown>;
      if (colA in o || colB in o) r = only;
    }
  }
  if (r != null && typeof r === 'object' && !Array.isArray(r)) {
    const o = r as Record<string, unknown>;
    if (colA in o || colB in o) {
      return [o[colA], o[colB]];
    }
  }
  const arr = Array.isArray(r) ? r : [r];
  const a = ia >= 0 ? arr[ia] : arr[0];
  const b = ib >= 0 ? arr[ib] : arr[1];
  return [a, b];
}

@Injectable()
export class GraphService {
  constructor(
    private readonly falkor: FalkorService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Con sharding por dominio sin scopePath, elige el subgrafo donde exista el nodo buscado.
   */
  private async pickShardGraph(
    projectId: string | undefined,
    scopePath: string | undefined,
    probe: (g: Awaited<ReturnType<FalkorService['getGraph']>>) => Promise<boolean>,
  ): Promise<Awaited<ReturnType<FalkorService['getGraph']>>> {
    if (!projectId) {
      return this.falkor.getGraph(undefined);
    }
    if (scopePath) {
      return this.falkor.getGraph(projectId, { repoRelativePath: scopePath });
    }
    const names = await this.falkor.getProjectGraphNames(projectId);
    if (names.length <= 1) {
      return this.falkor.getGraph(projectId);
    }
    for (const nm of names) {
      const g = await this.falkor.selectGraphByLogicalName(nm);
      try {
        if (await probe(g)) return g;
      } catch {
        /* grafo vacío o error de query */
      }
    }
    return this.falkor.getGraph(projectId);
  }

  private mapImpactQueryRows(result: FalkorResult): { name: unknown; labels: unknown }[] {
    const data = result.data ?? [];
    const headers =
      result.headers && result.headers.length ? result.headers : ['name', 'labels'];
    return data.map((row: unknown) => {
      const [name, labels] = extractFalkorTwoColumnRow(row, 'name', 'labels', headers);
      return { name, labels };
    });
  }

  /**
   * Añade al acumulador las aristas/nodos de un shard para un componente (RENDERS + caminos + padres).
   * Usado en bucle multi-shard: el primer shard sin datos no impide que otros aporten el vecindario.
   */
  private async appendComponentShardData(
    graph: FalkorGraph,
    name: string,
    depth: number,
    pid: string | undefined,
    accum: ComponentShardAccum,
  ): Promise<void> {
    const params: Record<string, string> = { componentName: name };
    if (pid) params.projectId = pid;

    const compMatch = pid ? ', projectId: $projectId' : '';
    /** Foco es un custom hook (:Hook): aristas Component -[:USES_HOOK]-> Hook (invertidas respecto al grafo “componente centrado”). */
    const hookFanIn = (await graph.query(
      pid
        ? `MATCH (h:Hook {name: $componentName, projectId: $projectId}) ` +
            `MATCH (consumer:Component {projectId: $projectId})-[:USES_HOOK]->(h) ` +
            `RETURN consumer, h`
        : `MATCH (h:Hook {name: $componentName}) ` +
            `MATCH (consumer:Component)-[:USES_HOOK]->(h) ` +
            `RETURN consumer, h`,
      { params },
    )) as FalkorResult;
    const hookFanHeaders =
      hookFanIn.headers && hookFanIn.headers.length ? hookFanIn.headers : ['consumer', 'h'];
    if ((hookFanIn.data ?? []).length > 0) {
      for (const row of hookFanIn.data ?? []) {
        const [consumerCell, hookCell] = extractFalkorTwoColumnRow(
          row,
          'consumer',
          'h',
          hookFanHeaders,
        );
        const hookNode = parseGraphNodeCell(hookCell);
        const consumerNode = parseGraphNodeCell(consumerCell);
        if (hookNode && consumerNode) {
          accum.nodes.set(hookNode.id, hookNode);
          accum.nodes.set(consumerNode.id, consumerNode);
          if (!accum.centerId) accum.centerId = hookNode.id;
          addGraphEdge(accum.edges, accum.edgeKey, consumerNode.id, hookNode.id, 'depends');
        }
      }
      return;
    }
    const hookOnly = (await graph.query(
      `MATCH (h:Hook {name: $componentName${compMatch}}) RETURN h`,
      { params },
    )) as FalkorResult;
    if ((hookOnly.data ?? []).length > 0) {
      const oh = hookOnly.headers && hookOnly.headers.length ? hookOnly.headers : ['h'];
      const row0 = hookOnly.data![0];
      const [, hookCell] = extractFalkorTwoColumnRow(row0 as unknown, 'h', 'h', oh);
      const hookNode = parseGraphNodeCell(hookCell ?? row0);
      if (hookNode) {
        accum.nodes.set(hookNode.id, hookNode);
        accum.centerId = hookNode.id;
      }
      return;
    }

    const dRel = Math.min(Math.max(depth, 1), 10);
    const importHop = Math.min(dRel, 5);
    const rendersRows = (await graph.query(
      pid
        ? `MATCH (c:Component {name: $componentName, projectId: $projectId})-[:RENDERS*1..${dRel}]->(dependency:Component) WHERE c.projectId = $projectId AND dependency.projectId = $projectId RETURN c, dependency`
        : `MATCH (c:Component {name: $componentName})-[:RENDERS*1..${dRel}]->(dependency:Component) RETURN c, dependency`,
      { params },
    )) as FalkorResult;
    const hookRows = (await graph.query(
      pid
        ? `MATCH (c:Component {name: $componentName, projectId: $projectId})-[:USES_HOOK]->(dependency:Hook) WHERE c.projectId = $projectId AND dependency.projectId = $projectId RETURN c, dependency`
        : `MATCH (c:Component {name: $componentName})-[:USES_HOOK]->(dependency:Hook) RETURN c, dependency`,
      { params },
    )) as FalkorResult;
    const importsRows = pid
      ? ((await graph.query(
          `MATCH (c:Component {name: $componentName, projectId: $projectId})<-[:CONTAINS]-(f:File {projectId: $projectId}) ` +
            `MATCH (f)-[:IMPORTS*1..${importHop}]->(f2:File {projectId: $projectId}) ` +
            `MATCH (f2)-[:CONTAINS]->(dependency:Component {projectId: $projectId}) ` +
            `WHERE c.projectId = $projectId AND dependency.projectId = $projectId RETURN c, dependency`,
          { params },
        )) as FalkorResult)
      : ({ data: [] as unknown[][] } as FalkorResult);
    const data = [
      ...(rendersRows.data ?? []),
      ...(hookRows.data ?? []),
      ...(importsRows.data ?? []),
    ];
    const headers =
      rendersRows.headers && rendersRows.headers.length
        ? rendersRows.headers
        : ['c', 'dependency'];

    for (const row of data as unknown[]) {
      const [centerCell, dep] = extractFalkorTwoColumnRow(row, 'c', 'dependency', headers);
      const centerNode = parseGraphNodeCell(centerCell);
      if (centerNode) {
        accum.nodes.set(centerNode.id, centerNode);
        if (!accum.centerId) accum.centerId = centerNode.id;
      }
      const depParsed = parseGraphNodeCell(dep);
      const obj =
        dep && typeof dep === 'object' && !Array.isArray(dep)
          ? (dep as Record<string, unknown>)
          : { name: dep != null ? falkorScalarToString(dep) ?? String(dep) : undefined };
      const key =
        [
          falkorScalarToString((obj as { repoId?: unknown }).repoId),
          falkorScalarToString((obj as { projectId?: unknown }).projectId),
          falkorScalarToString(obj.name),
          falkorScalarToString(obj.path),
        ]
          .filter(Boolean)
          .join('\0') ||
        (typeof dep === 'object' && dep != null ? JSON.stringify(dep) : String(dep));
      if (accum.seenDepKeys.has(key)) continue;
      accum.seenDepKeys.add(key);
      accum.dependencies.push({
        name: falkorScalarToString(obj.name),
        path: falkorScalarToString(obj.path),
      });
      if (depParsed && centerNode) {
        accum.nodes.set(depParsed.id, depParsed);
        addGraphEdge(accum.edges, accum.edgeKey, centerNode.id, depParsed.id, 'depends');
      }
    }

    const parentParams: Record<string, string> = { componentName: name };
    if (pid) parentParams.projectId = pid;
    const parentQ = pid
      ? `MATCH (parent:Component {projectId: $projectId})-[:RENDERS]->(c:Component {name: $componentName, projectId: $projectId}) WHERE parent.projectId = $projectId AND c.projectId = $projectId RETURN parent, c`
      : `MATCH (parent:Component)-[:RENDERS]->(c:Component {name: $componentName}) RETURN parent, c`;
    const parentRes = (await graph.query(parentQ, { params: parentParams })) as FalkorResult;
    const ph =
      parentRes.headers && parentRes.headers.length ? parentRes.headers : ['parent', 'c'];
    for (const row of parentRes.data ?? []) {
      const [parentCell, focalCell] = extractFalkorTwoColumnRow(row, 'parent', 'c', ph);
      const pr = parseGraphNodeCell(parentCell);
      const focal = parseGraphNodeCell(focalCell);
      if (!pr || !focal) continue;
      accum.nodes.set(pr.id, pr);
      accum.nodes.set(focal.id, focal);
      if (!accum.centerId) accum.centerId = focal.id;
      addGraphEdge(accum.edges, accum.edgeKey, pr.id, focal.id, 'depends');
    }
  }

  async getImpact(nodeId: string, projectId?: string, scopePath?: string) {
    const cached = await this.cache.get<{ nodeId: string; dependents: unknown[] }>(
      this.cache.impactKey(nodeId, projectId, scopePath),
    );
    if (cached) return cached;
    const matchProj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { nodeName: nodeId };
    if (projectId) params.projectId = projectId;

    const runImpact = async (graph: FalkorGraph) => {
      const result = (await graph.query(
        `MATCH (n {name: $nodeName${matchProj}})<-[:CALLS|RENDERS*]-(dependent) RETURN dependent.name AS name, labels(dependent) AS labels`,
        { params },
      )) as FalkorResult;
      const rows = this.mapImpactQueryRows(result);
      const seen = new Set(rows.map((r) => `${String(r.name)}\0${JSON.stringify(r.labels)}`));
      const mergeImpactRows = (extra: { name: unknown; labels: unknown }[]) => {
        for (const r of extra) {
          const k = `${String(r.name)}\0${JSON.stringify(r.labels)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          rows.push(r);
        }
      };
      /** React custom hooks (:Hook): consumidores son componentes con arista USES_HOOK (no siempre hay CALLS al hook). */
      const hookConsumersQ = projectId
        ? `MATCH (h:Hook {name: $nodeName, projectId: $projectId})<-[:USES_HOOK]-(consumer:Component {projectId: $projectId}) ` +
          `RETURN consumer.name AS name, labels(consumer) AS labels`
        : `MATCH (h:Hook {name: $nodeName})<-[:USES_HOOK]-(consumer:Component) ` +
          `RETURN consumer.name AS name, labels(consumer) AS labels`;
      mergeImpactRows(
        this.mapImpactQueryRows((await graph.query(hookConsumersQ, { params })) as FalkorResult),
      );
      if (!projectId) return rows;
      /** Consumidores vía IMPORTS entre archivos (módulos API / utils sin aristas RENDERS hacia otros Component). */
      const importCons = (await graph.query(
        `MATCH (c:Component {name: $nodeName, projectId: $projectId})<-[:CONTAINS]-(f:File {projectId: $projectId}) ` +
          `MATCH (f2:File {projectId: $projectId})-[:IMPORTS]->(f) ` +
          `MATCH (f2)-[:CONTAINS]->(consumer:Component {projectId: $projectId}) ` +
          `RETURN consumer.name AS name, labels(consumer) AS labels`,
        { params },
      )) as FalkorResult;
      mergeImpactRows(this.mapImpactQueryRows(importCons));
      return rows;
    };

    let dependents: { name: unknown; labels: unknown }[];

    if (!projectId || scopePath) {
      const graph = await this.pickShardGraph(projectId, scopePath, async (g) => {
        const r = (await g.query(
          `MATCH (n {name: $nodeName${matchProj}}) RETURN count(n) AS c`,
          { params },
        )) as FalkorResult;
        const row = r.data?.[0] as unknown;
        let c = 0;
        if (row != null && typeof row === 'object' && 'c' in row) {
          c = Number((row as { c: unknown }).c);
        } else if (Array.isArray(row)) {
          c = Number(row[0]);
        }
        return Number.isFinite(c) && c > 0;
      });
      dependents = await runImpact(graph);
    } else {
      const names = await this.falkor.getProjectGraphNames(projectId);
      const merged: { name: unknown; labels: unknown }[] = [];
      const seen = new Set<string>();
      const pushDeduped = (rows: { name: unknown; labels: unknown }[]) => {
        for (const r of rows) {
          const k = `${String(r.name)}\0${JSON.stringify(r.labels)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(r);
        }
      };
      if (names.length <= 1) {
        const g = await this.falkor.getGraph(projectId);
        pushDeduped(await runImpact(g));
      } else {
        for (const nm of names) {
          try {
            const g = await this.falkor.selectGraphByLogicalName(nm);
            pushDeduped(await runImpact(g));
          } catch {
            /* shard vacío */
          }
        }
      }
      dependents = merged;
    }

    const payload = { nodeId, dependents };
    await this.cache.set(this.cache.impactKey(nodeId, projectId, scopePath), payload, this.cache.TTL.impact);
    return payload;
  }

  async getComponent(name: string, depth: number, projectId?: string, scopePath?: string) {
    const pid = projectId?.trim() || undefined;
    const cached = await this.cache.get<{
      componentName: string;
      depth: number;
      projectId?: string;
      dependencies: unknown[];
      nodes: GraphNodeDto[];
      edges: GraphEdgeDto[];
      graphHints?: GraphComponentHintsDto;
    }>(this.cache.componentKey(name, depth, pid, scopePath));
    if (cached) return cached;

    const compMatch = pid ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName: name };
    if (pid) params.projectId = pid;

    const accum: ComponentShardAccum = {
      seenDepKeys: new Set<string>(),
      dependencies: [],
      nodes: new Map<string, GraphNodeDto>(),
      edgeKey: new Set<string>(),
      edges: [],
      centerId: null,
    };

    /**
     * Sin projectId o con scopePath: un solo grafo (comportamiento anterior).
     * Con projectId y varios subgrafos por dominio: fusionar todos — el primer shard donde exista
     * un stub de «App» ya no oculta las aristas RENDERS del shard correcto.
     */
    if (!pid || scopePath) {
      const graph = await this.pickShardGraph(pid, scopePath, async (g) => {
        const r = (await g.query(
          `MATCH (n) WHERE (n:Component OR n:Hook) AND n.name = $componentName${compMatch} RETURN count(n) AS c`,
          { params },
        )) as FalkorResult;
        const row = r.data?.[0] as unknown;
        let c = 0;
        if (row != null && typeof row === 'object' && 'c' in row) {
          c = Number((row as { c: unknown }).c);
        } else if (Array.isArray(row)) {
          c = Number(row[0]);
        }
        return Number.isFinite(c) && c > 0;
      });
      await this.appendComponentShardData(graph, name, depth, pid, accum);
    } else {
      const shardNames = await this.falkor.getProjectGraphNames(pid);
      if (shardNames.length <= 1) {
        const graph = await this.falkor.getGraph(pid);
        await this.appendComponentShardData(graph, name, depth, pid, accum);
      } else {
        for (const gName of shardNames) {
          try {
            const graph = await this.falkor.selectGraphByLogicalName(gName);
            await this.appendComponentShardData(graph, name, depth, pid, accum);
          } catch {
            /* shard vacío o no legible */
          }
        }
      }
    }

    const { dependencies, nodes, edgeKey, edges } = accum;
    let centerId = accum.centerId;

    if (!centerId) {
      centerId = graphNodeKey({ kind: 'Component', projectId: pid ?? '', name });
      nodes.set(centerId, {
        id: centerId,
        kind: 'Component',
        name,
        ...(pid ? { projectId: pid } : {}),
      });
    }

    const impact = await this.getImpact(name, pid, scopePath);

    for (const d of impact.dependents as { name?: unknown; labels?: unknown }[]) {
      const gn = impactNode(d.name, d.labels, pid);
      nodes.set(gn.id, gn);
      addGraphEdge(edges, edgeKey, gn.id, centerId!, 'legacy_impact');
    }

    normalizeComponentGraphFocal(nodes, edges, name, centerId);

    /** Priorizar el nodo centro del corte Falkor (evita colisión si hay varios nodos con el mismo nombre). */
    let focalIdForHints: string | null =
      centerId && nodes.has(centerId) ? centerId : null;
    if (!focalIdForHints) {
      for (const [id, n] of nodes) {
        if (
          n.name === name &&
          (n.kind === 'Component' || n.kind === 'Node' || n.kind === 'Hook')
        ) {
          focalIdForHints = id;
          break;
        }
      }
    }
    if (!focalIdForHints) focalIdForHints = centerId;
    const dependsOut = focalIdForHints
      ? edges.filter((e) => e.kind === 'depends' && e.source === focalIdForHints).length
      : 0;
    /** Para hooks el grafo usa consumer → hook (`depends` entrante al foco). */
    const dependsIntoFocal = focalIdForHints
      ? edges.filter((e) => e.kind === 'depends' && e.target === focalIdForHints).length
      : 0;
    const legacyInForHints = focalIdForHints
      ? edges.filter((e) => e.kind === 'legacy_impact' && e.target === focalIdForHints).length
      : 0;
    const graphHints: GraphComponentHintsDto | undefined =
      dependsOut === 0 &&
      dependsIntoFocal === 0 &&
      legacyInForHints === 0 &&
      pid
        ? {
            suggestResync: true,
            messageEs:
              'Sin aristas depends salientes ni consumidores (RENDERS/CALLS/IMPORTS→Component) hacia este foco. En repos **Nest/backend** suele ser **normal**: el índice pone servicios/controladores en :NestService/:NestController y el grafo de **componente** prioriza React (:Component, RENDERS). Tras reindexar, **RBAC**: **:AccessRole** con **ALLOWS_ACCESS_ROLE** desde **:NestController** y, por ruta HTTP, **:NestRoute** con **REQUIRES_ROLE** / **USES_GUARD** hacia **:NestGuard** (no en esta vista). Para acoplamiento usa **índice del repo** o Cypher sobre :Function / :NestService / :NestRoute / :AccessRole. Si crees que es React mal enlazado: resync, alcance «solo este repo» y comprueba projectId en Falkor.',
          }
        : undefined;

    const payload = {
      componentName: name,
      depth,
      ...(pid ? { projectId: pid } : {}),
      dependencies,
      nodes: [...nodes.values()],
      edges,
      ...(graphHints ? { graphHints } : {}),
    };
    await this.cache.set(
      this.cache.componentKey(name, depth, pid, scopePath),
      payload,
      this.cache.TTL.component,
    );
    return payload;
  }

  /**
   * Muestra relaciones crudas del índice Falkor (sin capa C4 ni roll-up de componente).
   * Devuelve hasta `limit` aristas `(a)-[r]->(b)` con `type(r)` tal cual en el grafo.
   */
  async getIndexedSnapshot(projectId: string, repoId?: string, limit = 500) {
    const pid = projectId.trim();
    const rid = repoId?.trim() || undefined;
    const lim = Math.min(2000, Math.max(50, limit));
    const cacheKey = this.cache.indexedSnapshotKey(pid, rid, lim);
    const cached = await this.cache.get<{
      projectId: string;
      repoId?: string;
      limit: number;
      truncated: boolean;
      nodes: GraphNodeDto[];
      edges: GraphEdgeDto[];
    }>(cacheKey);
    if (cached) return cached;

    const nodes = new Map<string, GraphNodeDto>();
    const edgeKey = new Set<string>();
    const edges: GraphEdgeDto[] = [];
    let rowCount = 0;
    let truncated = false;

    const repoFilter = rid ? ' AND a.repoId = $repoId AND b.repoId = $repoId' : '';
    const cypher =
      `MATCH (a)-[r]->(b) WHERE a.projectId = $projectId${repoFilter} AND NOT a:Project ` +
      `RETURN a, type(r) AS rel, b LIMIT $limit`;

    const shardContexts = await this.falkor.getCypherShardContexts(pid);
    const contexts =
      shardContexts.length > 0
        ? shardContexts
        : [
            {
              graphName: (await this.falkor.getProjectGraphNames(pid))[0] ?? 'FalkorSpecs',
              cypherProjectId: pid,
            },
          ];

    for (const ctx of contexts) {
      if (rowCount >= lim) {
        truncated = true;
        break;
      }
      const remaining = lim - rowCount;
      const params: Record<string, string | number> = {
        projectId: ctx.cypherProjectId,
        limit: remaining,
      };
      if (rid) params.repoId = rid;
      try {
        const graph = await this.falkor.selectGraphByLogicalName(ctx.graphName);
        const result = (await graph.query(cypher, { params })) as FalkorResult;
        const headers =
          result.headers && result.headers.length ? result.headers : ['a', 'rel', 'b'];
        for (const row of result.data ?? []) {
          if (rowCount >= lim) {
            truncated = true;
            break;
          }
          const [aCell, relCell, bCell] = extractFalkorRowCells(row, ['a', 'rel', 'b'], headers);
          const rel = falkorScalarToString(relCell) ?? 'REL';
          const aNode = parseGraphNodeCell(aCell);
          const bNode = parseGraphNodeCell(bCell);
          if (!aNode || !bNode) continue;
          nodes.set(aNode.id, aNode);
          nodes.set(bNode.id, bNode);
          addGraphEdge(edges, edgeKey, aNode.id, bNode.id, rel);
          rowCount += 1;
        }
      } catch {
        /* shard vacío o grafo inexistente */
      }
    }

    const payload = {
      projectId: pid,
      ...(rid ? { repoId: rid } : {}),
      limit: lim,
      truncated,
      nodes: [...nodes.values()],
      edges,
    };
    await this.cache.set(cacheKey, payload, this.cache.TTL.component);
    return payload;
  }

  async getContract(componentName: string, projectId?: string, scopePath?: string) {
    const cached = await this.cache.get<{
      componentName: string;
      props: { name: string; required: boolean }[];
    }>(this.cache.contractKey(componentName, projectId, scopePath));
    if (cached) return cached;
    const compMatch = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    const graph = await this.pickShardGraph(projectId, scopePath, async (g) => {
      const r = (await g.query(
        `MATCH (c:Component {name: $componentName${compMatch}}) RETURN count(c) AS c`,
        { params },
      )) as FalkorResult;
      const row = r.data?.[0] as unknown;
      let c = 0;
      if (row != null && typeof row === 'object' && 'c' in row) {
        c = Number((row as { c: unknown }).c);
      } else if (Array.isArray(row)) {
        c = Number(row[0]);
      }
      return Number.isFinite(c) && c > 0;
    });
    const props = await this.getPropsForComponent(graph, componentName, projectId);
    const payload = { componentName, props };
    await this.cache.set(
      this.cache.contractKey(componentName, projectId, scopePath),
      payload,
      this.cache.TTL.contract,
    );
    return payload;
  }

  private async getPropsForComponent(
    graph: Awaited<ReturnType<FalkorService['getGraph']>>,
    componentName: string,
    projectId?: string,
  ): Promise<{ name: string; required: boolean }[]> {
    const matchProj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    const result = (await graph.query(
      `MATCH (c:Component {name: $componentName${matchProj}})-[:HAS_PROP]->(p:Prop) RETURN p.name AS name, p.required AS required`,
      { params },
    )) as FalkorResult;
    const data = result.data ?? [];
    const headers = result.headers ?? ['name', 'required'];
    const nameIdx = headers.indexOf('name');
    const requiredIdx = headers.indexOf('required');
    return data.map((row: unknown) => {
      const arr = Array.isArray(row) ? row : [row];
      return {
        name: (nameIdx >= 0 ? arr[nameIdx] : arr[0]) as string,
        required:
          requiredIdx >= 0 ? arr[requiredIdx] === true || arr[requiredIdx] === 'true' : false,
      };
    });
  }

  // ── Helper queries for multi-dimensional compare ──────────────────────

  /** Sets of string names from {name, ...}[] */
  private static nameSet(items: { name: string }[]): Set<string> {
    return new Set(items.map((i) => i.name));
  }

  /** Diff two arrays of named objects: {match, main, shadow, missing, extra} */
  private static diffNamed<T extends { name: string }>(
    main: T[],
    shadow: T[],
  ): { match: boolean; main: T[]; shadow: T[]; missing: string[]; extra: string[] } {
    const mSet = GraphService.nameSet(main);
    const sSet = GraphService.nameSet(shadow);
    const missing = main.filter((p) => !sSet.has(p.name)).map((p) => p.name);
    const extra = shadow.filter((p) => !mSet.has(p.name)).map((p) => p.name);
    return { match: missing.length === 0 && extra.length === 0, main, shadow, missing, extra };
  }

  /** Query a graph and return rows as {name: string, ...rest} */
  private async queryNamed(
    graph: FalkorGraph,
    cypher: string,
    params: Record<string, string> = {},
  ): Promise<{ name: string }[]> {
    const r = (await graph.query(cypher, { params })) as FalkorResult;
    const data = r.data ?? [];
    const headers = r.headers ?? [];
    const nameIdx = headers.length ? headers.indexOf('name') : -1;
    return data.map((row: unknown) => {
      const arr = Array.isArray(row) ? row : [row];
      const name = (nameIdx >= 0 ? String(arr[nameIdx] ?? '') : String(arr[0] ?? ''));
      return { name };
    }).filter((x) => x.name);
  }

  // ── Per-dimension queries ─────────────────────────────────────────────

  private async getRelationNames(
    graph: FalkorGraph,
    componentName: string,
    relKind: string,
    projectId?: string,
  ): Promise<{ name: string }[]> {
    const proj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    if (relKind === 'USES_HOOK') {
      return this.queryNamed(graph,
        `MATCH (c:Component {name: $componentName${proj}})-[:USES_HOOK]->(h:Hook) RETURN h.name AS name`,
        params);
    }
    if (relKind === 'RENDERS') {
      return this.queryNamed(graph,
        `MATCH (c:Component {name: $componentName${proj}})-[:RENDERS]->(child:Component) RETURN child.name AS name`,
        params);
    }
    return [];
  }

  private async getImportTargets(
    graph: FalkorGraph,
    componentName: string,
    projectId?: string,
  ): Promise<{ name: string }[]> {
    const proj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    return this.queryNamed(graph,
      `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $componentName${proj}}) MATCH (f)-[:IMPORTS]->(imp:File) RETURN imp.path AS name`,
      params);
  }

  private async getCrossFileCallees(
    graph: FalkorGraph,
    componentName: string,
    projectId?: string,
  ): Promise<{ name: string }[]> {
    const proj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    return this.queryNamed(graph,
      `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $componentName${proj}})
       MATCH (f)-[:CONTAINS]->(fn:Function)-[:CALLS]->(callee:Function)
       WHERE callee.path <> f.path OR NOT EXISTS(callee.path)
       RETURN DISTINCT callee.path + '::' + callee.name AS name`,
      params);
  }

  private async getFileFunctions(
    graph: FalkorGraph,
    componentName: string,
    projectId?: string,
  ): Promise<{ name: string; startLine?: number; endLine?: number }[]> {
    const proj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    const r = (await graph.query(
      `MATCH (f:File)-[:CONTAINS]->(c:Component {name: $componentName${proj}})
       MATCH (f)-[:CONTAINS]->(fn:Function)
       RETURN fn.name AS name, fn.startLine AS startLine, fn.endLine AS endLine`,
      { params },
    )) as FalkorResult;
    const data = r.data ?? [];
    const headers = r.headers ?? [];
    const nameIdx = headers.indexOf('name');
    const slIdx = headers.indexOf('startLine');
    const elIdx = headers.indexOf('endLine');
    return data.map((row: unknown) => {
      const arr = Array.isArray(row) ? row : [row];
      const sl = slIdx >= 0 ? Number(arr[slIdx]) : undefined;
      const el = elIdx >= 0 ? Number(arr[elIdx]) : undefined;
      return {
        name: String(nameIdx >= 0 ? arr[nameIdx] ?? '' : arr[0] ?? ''),
        startLine: Number.isFinite(sl) ? sl : undefined,
        endLine: Number.isFinite(el) ? el : undefined,
      };
    }).filter((x) => x.name);
  }

  /** Components that RENDER this one in the main graph. */
  private async getDependentComponents(
    mainGraph: FalkorGraph,
    componentName: string,
    projectId?: string,
  ): Promise<{ name: string }[]> {
    const proj = projectId ? ', projectId: $projectId' : '';
    const params: Record<string, string> = { componentName };
    if (projectId) params.projectId = projectId;
    return this.queryNamed(mainGraph,
      `MATCH (dep:Component)-[:RENDERS]->(c:Component {name: $componentName${proj}}) RETURN dep.name AS name`,
      params);
  }

  /** For a dependent component, check which of its required RENDERS targets
   *  would be missing if this component's props changed in the shadow. */
  private async getDependentBreakingDetails(
    mainGraph: FalkorGraph,
    shadowGraph: FalkorGraph,
    componentName: string,
    dependentName: string,
    mainProps: { name: string; required: boolean }[],
    shadowProps: { name: string; required: boolean }[],
    projectId?: string,
  ): Promise<{
    missingProps: string[];
    newlyRequired: string[];
    removedInShadow: string[];
  } | null> {
    // Props that disappeared in shadow
    const shadowPropNames = new Set(shadowProps.map((p) => p.name));
    const missingInShadow = mainProps
      .filter((p) => p.required && !shadowPropNames.has(p.name))
      .map((p) => p.name);

    // Props that became required in shadow but weren't before
    const mainRequired = new Set(mainProps.filter((p) => p.required).map((p) => p.name));
    const newlyRequired = shadowProps
      .filter((p) => p.required && !mainRequired.has(p.name))
      .map((p) => p.name);

    // Props that were in main but are gone in shadow (optional props disappearing)
    const mainPropNames = new Set(mainProps.map((p) => p.name));
    const removed = mainProps
      .filter((p) => !shadowPropNames.has(p.name))
      .map((p) => p.name);

    if (missingInShadow.length === 0 && newlyRequired.length === 0 && removed.length === 0) {
      return null;
    }
    return { missingProps: missingInShadow, newlyRequired, removedInShadow: removed };
  }

  private static verdict(checks: boolean[]): 'approved' | 'breaking_changes' {
    return checks.every(Boolean) ? 'approved' : 'breaking_changes';
  }

  // ── Enhanced compare ──────────────────────────────────────────────────

  async compare(
    componentName: string,
    projectId?: string,
    shadowSessionId?: string,
    scopePath?: string,
  ) {
    // 1. Locate main graph (shard-aware)
    const mainGraph = await this.pickShardGraph(projectId, scopePath, async (g) => {
      const matchProj = projectId ? ', projectId: $projectId' : '';
      const params: Record<string, string> = { componentName };
      if (projectId) params.projectId = projectId;
      const r = (await g.query(
        `MATCH (c:Component {name: $componentName${matchProj}}) RETURN count(c) AS c`,
        { params },
      )) as FalkorResult;
      const row = r.data?.[0] as unknown;
      let c = 0;
      if (row != null && typeof row === 'object' && 'c' in row) {
        c = Number((row as { c: unknown }).c);
      } else if (Array.isArray(row)) {
        c = Number(row[0]);
      }
      return Number.isFinite(c) && c > 0;
    });

    const shadowGraph = await this.falkor.getShadowGraph(shadowSessionId ?? undefined);

    // 2. Fetch all dimensions in parallel
    const [
      mainProps,
      shadowProps,
      mainRenders,
      shadowRenders,
      mainHooks,
      shadowHooks,
      mainImports,
      shadowImports,
      mainCrossCalls,
      shadowCrossCalls,
      mainFunctions,
      shadowFunctions,
      dependents,
    ] = await Promise.all([
      // Props
      this.getPropsForComponent(mainGraph, componentName, projectId),
      this.getPropsForComponent(shadowGraph, componentName, undefined),
      // Relations
      this.getRelationNames(mainGraph, componentName, 'RENDERS', projectId),
      this.getRelationNames(shadowGraph, componentName, 'RENDERS'),
      this.getRelationNames(mainGraph, componentName, 'USES_HOOK', projectId),
      this.getRelationNames(shadowGraph, componentName, 'USES_HOOK'),
      // Imports
      this.getImportTargets(mainGraph, componentName, projectId),
      this.getImportTargets(shadowGraph, componentName),
      // Cross-file calls
      this.getCrossFileCallees(mainGraph, componentName, projectId),
      this.getCrossFileCallees(shadowGraph, componentName),
      // Functions
      this.getFileFunctions(mainGraph, componentName, projectId),
      this.getFileFunctions(shadowGraph, componentName),
      // Dependents (main graph only — who uses this component)
      this.getDependentComponents(mainGraph, componentName, projectId),
    ]);

    // 3. Compute diffs
    const props = {
      ...GraphService.diffNamed(mainProps, shadowProps),
      // Deep comparison: detect changed props (same name, different required/default)
      changed: this.detectChangedProps(mainProps, shadowProps),
    };

    const relations = {
      renders: GraphService.diffNamed(mainRenders, shadowRenders),
      usesHook: GraphService.diffNamed(mainHooks, shadowHooks),
    };

    const dependencies = {
      imports: GraphService.diffNamed(mainImports, shadowImports),
      crossFileCalls: GraphService.diffNamed(mainCrossCalls, shadowCrossCalls),
    };

    const functions = {
      ...GraphService.diffNamed(mainFunctions, shadowFunctions),
      changed: this.detectChangedFunctions(mainFunctions, shadowFunctions),
    };

    // 4. Dependents impact analysis
    const dependentsImpact = await this.buildDependentsImpact(
      mainGraph,
      shadowGraph,
      componentName,
      dependents,
      mainProps,
      shadowProps,
      projectId,
    );

    // 5. Overall verdict
    const allChecks = [
      props.match,
      relations.renders.match,
      relations.usesHook.match,
      dependencies.imports.match,
      dependencies.crossFileCalls.match,
      functions.match,
      dependentsImpact.breakingFor.length === 0,
    ];
    const verdict = GraphService.verdict(allChecks);

    return {
      componentName,
      match: allChecks.every(Boolean),
      verdict,
      props,
      relations,
      dependencies,
      functions,
      dependentsImpact,
    };
  }

  /** Detect props that exist in both but differ in required/default status. */
  private detectChangedProps(
    main: { name: string; required: boolean }[],
    shadow: { name: string; required: boolean }[],
  ): { name: string; main: { required: boolean }; shadow: { required: boolean } }[] {
    const shadowMap = new Map(shadow.map((p) => [p.name, p]));
    const changed: { name: string; main: { required: boolean }; shadow: { required: boolean } }[] = [];
    for (const mp of main) {
      const sp = shadowMap.get(mp.name);
      if (sp && sp.required !== mp.required) {
        changed.push({ name: mp.name, main: { required: mp.required }, shadow: { required: sp.required } });
      }
    }
    return changed;
  }

  /** Detect functions that changed signature (name match, line range diff = body change). */
  private detectChangedFunctions(
    main: { name: string; startLine?: number; endLine?: number }[],
    shadow: { name: string; startLine?: number; endLine?: number }[],
  ): { name: string; linesChanged: boolean }[] {
    const shadowMap = new Map(shadow.map((f) => [f.name, f]));
    const changed: { name: string; linesChanged: boolean }[] = [];
    for (const mf of main) {
      const sf = shadowMap.get(mf.name);
      if (sf) {
        const linesChanged =
          mf.startLine !== sf.startLine || mf.endLine !== sf.endLine;
        if (linesChanged) {
          changed.push({ name: mf.name, linesChanged: true });
        }
      }
    }
    return changed;
  }

  /** For each dependent component, check if shadow prop changes would break it. */
  private async buildDependentsImpact(
    mainGraph: FalkorGraph,
    shadowGraph: FalkorGraph,
    componentName: string,
    dependents: { name: string }[],
    mainProps: { name: string; required: boolean }[],
    shadowProps: { name: string; required: boolean }[],
    projectId?: string,
  ) {
    const depMap = new Map<string, { missingProps: string[]; newlyRequired: string[]; removedInShadow: string[] }>();
    for (const dep of dependents) {
      const detail = await this.getDependentBreakingDetails(
        mainGraph, shadowGraph, componentName, dep.name,
        mainProps, shadowProps, projectId,
      );
      if (detail) depMap.set(dep.name, detail);
    }
    const affected = dependents.map((d) => d.name);
    const breakingFor = [...depMap.keys()];
    return {
      affected,
      breakingFor,
      details: Object.fromEntries(depMap),
    };
  }

  async getManual(projectId?: string): Promise<string> {
    if (isProjectShardingEnabled() && !projectId) {
      return [
        '# Manual de componentes',
        '',
        '_Con `FALKOR_SHARD_BY_PROJECT` activo indica `?projectId=` en GET /graph/manual._',
      ].join('\n');
    }
    const graph = await this.falkor.getGraph(projectId);
    const projFilter = projectId ? ' WHERE p.projectId = $projectId' : '';
    const projParams = projectId ? { params: { projectId } } : {};
    const projectsRes = (await graph.query(
      `MATCH (p:Project)${projFilter} RETURN p.projectId AS id, p.projectName AS name, p.rootPath AS rootPath, p.branch AS branch`,
      projParams,
    )) as FalkorResult;
    const projects = (projectsRes.data ?? []) as [string, string, string, string | null][];
    const lines: string[] = ['# Manual de componentes (generado desde grafo)', ''];

    for (const [id, name, rootPath, branch] of projects) {
      lines.push(`## ${name}${branch ? ` (rama: ${branch})` : ''}`, '');
      const routesRes = (await graph.query(
        `MATCH (rt:Route {projectId: $projectId}) RETURN rt.path AS path, rt.componentName AS componentName ORDER BY rt.path`,
        { params: { projectId: id } },
      )) as FalkorResult;
      const routes = (routesRes.data ?? []) as [string, string][];
      if (routes.length > 0) {
        lines.push('### Flujo de rutas', '');
        for (const [path, componentName] of routes) {
          lines.push(`- \`${path}\` → **${componentName}**`);
        }
        lines.push('');
      }
      const compRes = (await graph.query(
        `MATCH (c:Component {projectId: $projectId}) RETURN c.name AS name, c.description AS description`,
        { params: { projectId: id } },
      )) as FalkorResult;
      const comps = (compRes.data ?? []) as [string, string | null][];
      if (comps.length === 0) {
        lines.push('_Sin componentes indexados._', '');
        continue;
      }
      for (const [compName, description] of comps) {
        lines.push(`### ${compName}`, '');
        if (description && String(description).trim()) {
          lines.push(String(description).trim(), '');
        }
        const props = await this.getPropsForComponent(graph, compName, id);
        if (props.length > 0) {
          lines.push('**Props:**', '');
          for (const p of props) {
            lines.push(`- \`${p.name}\` (${p.required ? 'requerido' : 'opcional'})`);
          }
          lines.push('');
        }
      }
    }
    return lines.join('\n');
  }

  /**
   * Ejecuta Cypher contra Falkor con la misma selección de grafo que el resto de la API.
   * Requiere `FALKOR_DEBUG_CYPHER=1` en el proceso API (evita abrir escritura arbitraria en prod).
   * Solo lectura: rechaza CREATE/MERGE/DELETE/SET/REMOVE/DROP/LOAD CSV (heurística, no sandbox formal).
   */
  async executeDebugCypher(body: {
    query: string;
    params?: Record<string, unknown>;
    projectId?: string;
    scopePath?: string;
    graphName?: string;
  }): Promise<{ headers: string[]; data: unknown[][]; graphLabel: string }> {
    const enabled =
      process.env.FALKOR_DEBUG_CYPHER === '1' || process.env.FALKOR_DEBUG_CYPHER === 'true';
    if (!enabled) {
      throw new HttpException(
        'Cypher debug desactivado. Define FALKOR_DEBUG_CYPHER=1 en el servicio API (misma conexión Falkor que Nest).',
        HttpStatus.FORBIDDEN,
      );
    }
    const q = String(body.query ?? '').trim();
    if (!q.length) {
      throw new HttpException('query vacía', HttpStatus.BAD_REQUEST);
    }
    if (q.length > 12000) {
      throw new HttpException('query demasiado larga (máx. 12000 caracteres)', HttpStatus.BAD_REQUEST);
    }
    this.assertReadOnlyCypher(q);
    const params =
      body.params != null && typeof body.params === 'object' && !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : undefined;

    const { graph, graphLabel } = await this.graphForDebugQuery({
      projectId: body.projectId,
      scopePath: body.scopePath,
      graphName: body.graphName,
    });

    const result = (await graph.query(
      q,
      params
        ? { params: params as Record<string, string | number | boolean | null> }
        : undefined,
    )) as FalkorResult;
    const headers = result.headers ?? [];
    const rawData = result.data ?? [];
    const data = rawData.map((row) => {
      const arr = Array.isArray(row) ? row : [row];
      return arr.map((cell) => this.serializeFalkorDebugCell(cell));
    });

    return { headers, data, graphLabel };
  }

  private assertReadOnlyCypher(q: string): void {
    const deny = [
      /\bCREATE\b/i,
      /\bMERGE\b/i,
      /\bDELETE\b/i,
      /\bDETACH\b/i,
      /\bDROP\b/i,
      /\bREMOVE\b/i,
      /\bSET\b/i,
      /\bLOAD\s+CSV\b/i,
    ];
    for (const re of deny) {
      if (re.test(q)) {
        throw new HttpException(
          'Solo consultas de lectura (CREATE/MERGE/DELETE/DETACH/SET/REMOVE/DROP/LOAD CSV no permitidos)',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private async graphForDebugQuery(opts: {
    projectId?: string;
    scopePath?: string;
    graphName?: string;
  }): Promise<{ graph: FalkorGraph; graphLabel: string }> {
    const gn = opts.graphName?.trim();
    if (gn) {
      const graph = await this.falkor.selectGraphByLogicalName(gn);
      return { graph, graphLabel: gn };
    }
    const pid = opts.projectId?.trim() || undefined;
    const sp = opts.scopePath?.trim() || undefined;
    if (pid) {
      const graph = await this.falkor.getGraph(pid, sp ? { repoRelativePath: sp } : undefined);
      return { graph, graphLabel: sp ? `${pid}|scope:${sp}` : pid };
    }
    const graph = await this.falkor.getGraph(undefined);
    return { graph, graphLabel: 'default' };
  }

  private serializeFalkorDebugCell(cell: unknown): unknown {
    if (cell == null) return cell;
    const t = typeof cell;
    if (t !== 'object') return cell;
    if (Array.isArray(cell)) return cell.map((c) => this.serializeFalkorDebugCell(c));
    const o = cell as Record<string, unknown>;
    if (Array.isArray(o.labels)) {
      return {
        labels: o.labels,
        properties:
          o.properties != null && typeof o.properties === 'object'
            ? o.properties
            : { ...o, labels: undefined },
      };
    }
    try {
      return JSON.parse(JSON.stringify(cell)) as unknown;
    } catch {
      return String(cell);
    }
  }

  async shadowProxy(
    files: { path: string; content: string }[],
    shadowSessionId?: string,
  ) {
    const url = process.env.INGEST_URL ?? 'http://ingest:3002';
    const r = await fetch(`${url}/shadow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files,
        ...(shadowSessionId != null && String(shadowSessionId).trim()
          ? { shadowSessionId: String(shadowSessionId).trim() }
          : {}),
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok)
      throw Object.assign(new Error('Ingest shadow index failed'), { status: r.status, data });
    return data;
  }
}
