# RepoChat

Página de chat con el repositorio: preguntas en lenguaje natural → Cypher → FalkorDB.

## Layout (rediseño UX)

- **Split horizontal:** panel «Chats» fijo a la **izquierda** (scroll interno, ~240px); conversación o análisis a la derecha. En móvil el historial va en drawer (icono panel).
- **Vista conmutada Chat ↔ Análisis:** el botón de cabecera alterna la columna principal (no drawer estrecho). Al ejecutar un análisis se abre la vista Análisis automáticamente.
- **Análisis a pantalla completa:** `ChatAnalysisPanel` — barra superior con acciones + informe ancho debajo; columna **●** con semáforo por fila de tabla / ítem de lista.
- **Opciones avanzadas:** popover «Opciones» (modo de respuesta, alcance opcional, memoria compactada).
- **Cabecera compacta:** volver al repo, badges de modo/alcance, interruptor Chat/Análisis, **The Forge** (opcional) y Nueva conversación.

## Promoción a The Forge (opcional)

- Botón **The Forge** visible **solo** con integración habilitada en **Ajustes → The Forge (opcional)** (admin).
- Sin The Forge: chat y análisis siguen igual; no aparece el botón.
- API: `GET /theforge-integration/status`, endpoints de conversación bajo demanda.
- Contrato pack: `docs/contracts/change-promotion-pack-v1.md`.
- Dev: `THEFORGE_PROMOTE_MOCK=true` simula promoción E2E.

## Persistencia (por usuario)

- Tablas Postgres: `chat_conversations`, `chat_messages` (ingest).
- API: `GET/POST /repositories/:id/conversations`, `GET/POST /projects/:id/conversations`, `GET/POST/DELETE /conversations/:id/...`.
- Cada hilo es independiente: cambiar de chat no mezcla memoria LLM (`history[]` se reconstruye solo desde ese hilo).
- Título auto desde el primer mensaje del usuario; eliminar con icono papelera (confirmación).

## Componentes

| Archivo | Rol |
|---------|-----|
| **RepoChat.tsx** | Estado, envío de chat y orquestación |
| **useChatPersistence.ts** | Hook: listar, crear, seleccionar, borrar y persistir mensajes |
| **useTheForgeChatPromotion.ts** | Hook: ¿integración Forge activa? (oculta botón si no) |
| **ChatConversationsSidebar.tsx** | Lista de chats + botón Nuevo |
| **ChatConversationsPanel.tsx** | Sidebar desktop + drawer móvil |
| **ChatPageHeader.tsx** | Cabecera compartida repo/proyecto (interruptor Chat/Análisis) |
| **ChatRepoHeader.tsx** | Wrapper repo → ChatPageHeader |
| **ChatForgePromoteDialog.tsx** | Modal promover conversación → etapa The Forge |
| **ChatProjectScopeOptions.tsx** | Multi-repo: foco + chat amplio (solo proyecto) |
| **ChatMessageThread.tsx** | Burbujas, empty state con chips, Cypher colapsable, **Copiar Markdown** en respuestas |
| **ChatCopyMarkdownButton.tsx** | Copia la respuesta cruda (GFM + fences `mermaid`/`cypher`) al portapapeles |
| **chat-markdown-export.util.ts** | Arma el texto Markdown exportable (contenido + Cypher opcional) |
| **ChatComposer.tsx** | Textarea + Enviar |
| **ChatAnalysisPanel.tsx** | Vista análisis inline (informes + acciones) |
| **AnalysisSemaphoreSummary.tsx** | Resumen agregado de semáforos |
| **AnalysisMarkdownReport.tsx** | Markdown del informe con semáforo por fila/sección |
| **ChatAnalysisSheet.tsx** | Alias legacy del panel (sin drawer) |
| **ChatOptionsPopover.tsx** | Modo pipeline + alcance |
| **ChatAssistantContent.tsx** | MDD / Markdown / Mermaid; sección **Archivos a tocar** colapsada |
| **ArchivosATocarSection.tsx** | `<details>` + tabla (Archivo, Repo, **Qué tocar/modificar**, Símbolo) |
| **chat-archivos-section.util.ts** | Parte el markdown y parsea tablas/viñetas de «Archivos a tocar» |
| **FullAuditModal.tsx** | Full Repo Audit |
| **chatConstants.ts** | Etiquetas y acciones de análisis |
| **analysis-semaphore.util.ts** | Heurística de severidad en markdown |

## Alcance opcional

Prefijos y globs en **Opciones** → popover. Se envían como `scope` en chat y analyze.

## Modo de respuesta

Ver **ChatPipelineModeSelect** y `ingestOptionsFromChatPipelineMode` (`frontend/src/utils/chat-pipeline-mode.ts`).

## Memoria en petición LLM

La compactación in-memory para el POST (`history[]`) sigue en `frontend/src/utils/chat-history-payload.ts`. La persistencia en DB guarda el texto completo del hilo activo.
