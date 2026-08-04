/** Extra rules when generating # Tasks for NEW→LEG integration handoffs (not greenfield). */
export const CURSOR_TASKS_INTEGRATION_HANDOFF_SUPPLEMENT = `MODO INTEGRACIÓN NEW→LEG (handoff):
- El MDD y el grafo describen el sistema LEGACY **ya existente** (login, auth, layout, rutas base, etc.). NO generes tareas para implementar features que ya están en producción.
- Genera SOLO tareas para integrar la capacidad NEW descrita en changeDescription, integrationHandoff y criterios de aceptación dentro del brownfield LEG.
- Prioriza changePlanSeed.tasks y modificationPlan.filesToModify. No amplies alcance más allá de esos paths salvo tests/deploy mínimos ligados a esos archivos.
- Frontend LEG: wiring (API client, props, hooks, datos) hacia el microservicio NEW; NO recrear pantallas completas ya existentes (login, shell, sidebar, home) salvo cambio explícito en el handoff.
- Backend LEG: adaptadores, DTOs, proxies o BFF si aplica; el microservicio NEW es externo — no reimplementar su dominio en LEG salvo contrato de integración.
- Si un AC del handoff ya está cubierto por código legacy existente, omite la tarea o márcala change_type: modify con alcance mínimo.
- Si `integrationHandoff.acceptanceCriteria` o el changeDescription mencionan endpoints, BFF, webhooks, content-types Strapi o rutas API → incluye al menos una tarea en **## Backend tasks** con paths del plan o rutas inferidas (proxy/BFF/adaptador).
- Si una sección H2 no tiene trabajo real para este handoff, escribe _Sin tareas en esta categoría para el alcance actual._ sin inventar trabajo.`;
