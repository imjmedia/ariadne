# ComponentGraph

Vista **Explorador de grafo** (`/graph-explorer`):

- **Grafo indexado (por defecto)** — `GET /api/graph/indexed-snapshot?projectId=&repoId=&limit=` devuelve nodos y aristas **tal cual en Falkor** tras sync (`IMPORTS`, `CONTAINS`, `CALLS`, `RENDERS`, `DECLARES_ROUTE`, …). Sin capa C4.
- **Enfoque componente (opcional)** — `GET /api/graph/component/:name?depth=&projectId=` subgrafo de dependencias React/Nest (`depends` / `legacy_impact`).

- **Alcance**: *Proyectos* (shard completo), *Repos por proyecto* (`repoId` en snapshot) y *Repositorios aislados*.
- **Semáforo**: `graph-summary?full=1` muestra conteos File/Component/Function/Route en la muestra del índice.

## Visualización

- **[vis-network](https://visjs.github.io/vis-network/docs/network/)** (`ComponentGraphVisView.tsx`): layout forceAtlas2Based, zoom, pan, Encuadrar / Autolayout.
- **Modo indexado**: colores por `type(r)` Falkor (`edgeColorForKind` en `componentGraphFlow.ts`).
- **Modo componente**: clic en nodo periférico → expansión depth 1 (`mergeGraphNodes` / `mergeGraphEdges`).

### Debug Falkor

- **`ComponentGraphDebugPanel.tsx`**: Cypher read-only `POST /api/graph/falkor-debug-query` (`FALKOR_DEBUG_CYPHER=1`).

### Archivos

| Archivo | Rol |
|--------|-----|
| `index.tsx` | Alcance, límite de aristas, carga indexada / enfoque |
| `ComponentGraphVisView.tsx` | Canvas vis-network |
| `componentGraphFlow.ts` | Tipos, colores de arista, `filterValidEdges` |
| `graphMerge.ts` | Fusión al expandir componente |

Query típica: `?scope=project:uuid|repo:uuid&projectId=`.
