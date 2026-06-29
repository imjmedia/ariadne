---
id: navigation-map
title: Navigation Map
category: Arquitectura
last_updated: 2026-06-29
---

# Navigation Map

> **AI Context Brief:** La tool `generate_navigation_map` produce el mapa de rutas del frontend con componentes, formularios y endpoints de API; léelo para entender qué devuelve y cuándo usarla (auditoría de navegación, diffs entre versiones).

## 1. Uso Básico (Quick Start)

```typescript
// Mapa completo de rutas del frontend del proyecto indexado:
await generate_navigation_map({ projectId: "<repo-id>" });

// Soporta modo diff para comparar dos estados/versiones del mapa.
```

## 2. API & Contrato de Tipos (Specs)

| Aspecto         | Detalle                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| Implementación  | `services/mcp-ariadne/src/navigation-map-scanner.ts`                    |
| Salida          | Mapa de rutas → componentes que renderiza, formularios y endpoints API. |
| Modo diff       | Compara dos versiones del mapa (qué rutas/forms/endpoints cambiaron).   |
| Relacionada     | `extract_design_tokens` (tokens Tailwind/CSS), `get_component_graph`.   |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Es una vista **derivada del grafo indexado**; su precisión depende de que el repo esté sincronizado (`get_sync_status`).
- **Regla 2:** Úsala para auditar navegación y cobertura de endpoints, no como sustituto de leer un componente concreto (`get_file_content`).
- **Regla 3:** El modo diff es para comparar versiones; para impacto puntual de un cambio usa `get_affected_scopes`.
