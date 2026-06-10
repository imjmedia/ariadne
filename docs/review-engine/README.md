# Review Engine — Legacy Change Review via MCP

## 🎯 Visión

Servicio de revisión automatizada de cambios en código *legacy*, accesible desde cualquier IDE a través del **MCP de Ariadne/TheForge**. Toma un diff de cambios y emite un reporte estructurado con hallazgos categorizados y **puntaje de confianza** (`confidence_pct`).

**Problema que resuelve:** Los cambios hechos con ayuda de IA (Agents) en sistemas legacy no tienen tests unitarios que validen su corrección. El programador no tiene visibilidad del impacto real del cambio. Review Engine llena ese vacío con un análisis multi-lente que considera el contexto del grafo Ariadne (dependencias, impacto legacy, cobertura de tests).

---

## 📐 Arquitectura

```
IDE (cualquiero) → MCP Client
 │
 ▼
Servidor MCP Ariadne (mcp-ariadne)
 │ POST /api/internal/review/diff
 ▼
Ingest Service (review module)
 │
 ┌────┼────┐
 ▼ ▼ ▼
Falkor LLM Artifact
(Graph) (API) (JSON)
```

### Servicios involucrados

| Servicio | Rol |
|----------|-----|
| **mcp-ariadne** | Expone la MCP tool `review_diff`. Recibe el diff del IDE, lo envía al ingest. |
| **ingest** (review module) | Ejecuta el pipeline de revisión: parseo de diff, consulta al grafo Ariadne, detección multi-lente, scoring, validación profunda, render. |
| **FalkorDB** | Grafo Ariadne con dependencias, impacto legacy, referencias. |
| **LLM API** | Lentes de detección (Sonnet) y validación (Opus). |

---

## 🧵 Pipeline de Revisión

```
Fase 0 ─ Preflight
├── Parse diff → archivos modificados, líneas, stats
├── Consultar Ariadne graph:
│ ├── get_legacy_impact por archivo
│ ├── get_component_graph por archivo
│ └── get_references por función modificada
└── Calcular legacy_context (impacto, dependencias, test_coverage)

Fase 1 ─ Detección (5 lentes paralelos)
├── L1: Correctness — bugs lógicos, null safety, edge cases
├── L2: Security — SQLi, XSS, auth bypass, data exposure
├── L3: Legacy Safety — breaking changes en APIs/firmas existentes,
│ side effects en funciones compartidas
├── L4: Data Integrity — migraciones, cambios de tipo, validaciones
└── L5: Architecture Consistency — violaciones de patrón, 
 acoplamiento inesperado, duplicación

Fase 2 ─ Dedup
└── Sonnet normaliza findings equivalentes de distintos lentes

Fase 3 ─ Scoring con Contexto Legacy
├── score_phase3: evaluación rápida Sonnet (0-100)
├── legacy_impact_penalty: ajuste según dependencias
│ └── >5 dependencias → -10 puntos
├── test_gap_penalty: código sin tests → -15 puntos
├── Gate de entrada a validación profunda:
│ score_compuesto ≥ 45 → pasa a Fase 4
│ score_compuesto < 45 → below_gate (se reporta como informativo)
└── source_families: cuantos lentes detectaron el mismo finding

Fase 4 ─ Validación Profunda (con Ariadne)
├── Deep (correctness, security): Opus por finding
│ └── incorpora contexto del grafo Ariadne
├── Light (legacy_safety, data_integrity, arch): Sonnet batch
└── Disposición:
 confianza < 45 → disproven
 confianza 45-59 → uncertain 
 confianza ≥ 60 → confirmed (strength: moderate/strong)

Fase 5 ─ Cross-cutting Legacy
├── Opus revisa findings confirmados en conjunto
├── Busca interacciones: "este fix para X crea problema en Y?"
└── Emite cross_cutting_groups

Fase 6 ─ Reporte Final
├── Render Markdown + JSON machine-readable
├── Por finding: descripción, archivo:línea, score, confianza,
│ legacy_impact, acción sugerida
├── Resumen ejecutivo
└── Legacy risk score global + confidence_pct general
```

---

## 🧮 Modelo de Confianza

```
confidence_pct = weighted_mean(
 code_quality_score (peso 0.40) — evaluación del lente Fase 4
 legacy_impact_score (peso 0.25) — cuánto código legacy toca
 breaking_risk_score (peso 0.20) — riesgo de romper dependencias
 evidence_score (peso 0.15) — cuántos lentes coinciden
) - test_gap_penalty (penalización fija: -0.10 si sin tests)
```

**Interpretación:**
- **≥ 80%:** Alta confianza. El cambio es seguro.
- **60-79%:** Confianza moderada. Revisar manualmente findings marcados.
- **< 60%:** Baja confianza. Requiere revisión manual detallada.
- **test_gap activo:** Si los archivos modificados no tienen tests, el score se penaliza -10% automáticamente.

---

## 📋 MCP Tools

### review_diff

Inicia una revisión de cambios legacy. Acepta un diff en formato unificado o una referencia a PR.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `diff` | string | opcional* | Texto del diff en formato unificado (`git diff`) |
| `prUrl` | string | opcional* | URL del PR en GitHub/Bitbucket |
| `branch` | string | opcional | Rama a comparar (default: main/master) |
| `projectId` | string | recomendado | ID del proyecto Ariadne (para contexto del grafo) |
| `repoPath` | string | recomendado | Ruta absoluta del repo local |
| `wait` | boolean | opcional | true: espera resultado (default). false: devuelve reviewId para polling |

*\*Debe proveerse al menos uno de `diff` o `prUrl`.*

**Respuesta (modo wait):**
```json
{
 "reviewId": "rev_01JN...",
 "status": "completed",
 "overallConfidence": 68,
 "summary": {
 "totalFindings": 4,
 "critical": 2,
 "moderate": 1,
 "info": 1,
 "legacyRisk": "alto",
 "testCoverage": "0% en archivos modificados"
 },
 "findings": [ ... ],
 "reportMarkdown": "## 🧪 Legacy Change Review..."
}
```

### review_diff_status

Polling para reviews async.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `reviewId` | string | sí | ID del review obtenido en review_diff con wait=false |

### review_diff_report

Obtiene el reporte renderizado.

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `reviewId` | string | sí | ID del review |
| `format` | string | opcional | `json` o `md` (default: `md`) |

---

## 📄 Formato del Reporte

### Hallazgo individual

```json
{
 "id": "F001",
 "type": "correctness",
 "severity": "critical",
 "filePath": "src/services/claims.service.ts",
 "lineStart": 234,
 "lineEnd": 240,
 "title": "Posible null pointer en processClaim()",
 "description": "La función processClaim() llama a getPolicy() sin null-check...",
 "confidence": 82,
 "legacyImpact": {
 "dependents": 3,
 "files": ["policy.service.ts", "reports.service.ts", "admin.controller.ts"],
 "breakingRisk": "medium"
 },
 "testGap": true,
 "suggestedAction": "Agregar null-check antes de llamar a getPolicy()",
 "fixHint": "```typescript\nconst policy = await getPolicy(claim.policyId);\nif (!policy) throw new NotFoundException('Póliza no encontrada');\n```"
}
```

### Resumen ejecutivo

```
## 🧪 Legacy Change Review

**Proyecto:** Seguros (legacy)
**Confianza general:** 68%
**test_gap_penalty:** -15%
**legacy_impact_penalty:** -10%

### 🔴 Críticos (2)
- **F001** — Posible null pointer en processClaim() (confianza: 82%)
- **F002** — Breaking change: firma de calculatePremium() (confianza: 65%)

### 🟡 Moderados (1)
- **F003** — Campo opcional mal manejado en updatePolicy() (confianza: 58%)

### ℹ️ Informativos (1)
- **F004** — Variable no utilizada tras refactor (confianza: 45%)

### Legacy Risk
- Dependencias afectadas: 22 en total
- Áreas sin tests: 3 de 4 archivos modificados
- Riesgo de regresión: **alto**

### Recomendación
Revisar F001 y F002 manualmente antes de mergear.
F001 requiere agregar null-check.
F002 requiere actualizar 12 callers existentes.
```

---

## 🗺️ Roadmap de Implementación

### Fase 1 — Core (esta iteración)
- [x] Documentación del diseño
- [ ] Endpoint `POST /api/internal/review/diff` en ingest
- [ ] Parseo de diff unificado
- [ ] Fase 0: consulta al grafo Ariadne
- [ ] Fase 1-3: detección + scoring básico
- [ ] Schema JSON del artifact
- [ ] MCP tool `review_diff` (modo wait)
- [ ] Reporte Markdown

### Fase 2 — Validación Profunda
- [ ] Fase 4: validación Opus/Sonnet con contexto de grafo
- [ ] Modelo de confianza completo con penalizaciones
- [ ] Fase 5: cross-cutting review
- [ ] MCP tools: `review_diff_status`, `review_diff_report`
- [ ] Reporte JSON machine-readable

### Fase 3 — Integración con PRs
- [ ] Publicación automática como comentario en PR
- [ ] Webhook que detecta PRs nuevos
- [ ] Badge de confianza en el PR

### Fase 4 — Feedback & Mejora Continua
- [ ] Tracking de precisión histórica
- [ ] Auto-corrección del scoring basado en feedback
- [ ] Interfaz web para revisar reportes
- [ ] Marcar falsos positivos

---

## 🔗 Integración con el Ecosistema TheForge

**Flujo típico del desarrollador:**

1. El agente IA (Ariadne) analiza el código legacy y propone cambios
2. El desarrollador revisa y acepta los cambios en su IDE
3. Ejecuta `review_diff` desde el IDE via MCP
4. El engine consulta el grafo Ariadne para contexto legacy
5. Corre el pipeline multi-lente
6. Recibe un reporte con confianza y hallazgos
7. Decide si mergear o hacer correcciones adicionales

**Diferencia vs adamsreview:**

| Capacidad | adamsreview | Review Engine |
|-----------|-------------|---------------|
| IDE | Solo Claude Code | **Cualquier IDE via MCP** |
| Contexto legacy | Solo git diff | **+ Grafo Ariadne** |
| Scoring confianza | Score 0-100 | **confidence_pct + penalizaciones** |
| Test gap awareness | No | **Sí** |
| Integración TheForge | No | **Sí** — enlaza con MDD/BRD |
