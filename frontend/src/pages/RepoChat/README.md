# RepoChat

Página de chat con el repositorio: preguntas en lenguaje natural → Cypher → FalkorDB.

## Layout (rediseño UX)

- **Conversación + historial:** panel izquierdo «Chats» (estilo NotebookLM/Gemini) con conversaciones persistidas por usuario; en móvil se abre con el icono de panel.
- **Una columna principal:** conversación; sin split permanente de herramientas.
- **Análisis bajo demanda:** panel lateral (`ChatAnalysisSheet`) con 3 acciones frecuentes + acordeón «Más análisis».
- **Opciones avanzadas:** popover «Opciones» (modo de respuesta, alcance opcional, memoria compactada).
- **Cabecera compacta:** volver al repo, badges de modo/alcance, botones Análisis y Nueva conversación.

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
| **ChatConversationsSidebar.tsx** | Lista de chats + botón Nuevo |
| **ChatConversationsPanel.tsx** | Sidebar desktop + drawer móvil |
| **ChatPageHeader.tsx** | Cabecera compartida repo/proyecto |
| **ChatRepoHeader.tsx** | Wrapper repo → ChatPageHeader |
| **ChatProjectScopeOptions.tsx** | Multi-repo: foco + chat amplio (solo proyecto) |
| **ChatMessageThread.tsx** | Burbujas, empty state con chips, Cypher colapsable |
| **ChatComposer.tsx** | Textarea + Enviar |
| **ChatAnalysisSheet.tsx** | Panel de análisis e informes |
| **ChatOptionsPopover.tsx** | Modo pipeline + alcance |
| **ChatAssistantContent.tsx** | MDD / Markdown / Mermaid |
| **FullAuditModal.tsx** | Full Repo Audit |
| **chatConstants.ts** | Etiquetas y acciones de análisis |

## Alcance opcional

Prefijos y globs en **Opciones** → popover. Se envían como `scope` en chat y analyze.

## Modo de respuesta

Ver **ChatPipelineModeSelect** y `ingestOptionsFromChatPipelineMode` (`frontend/src/utils/chat-pipeline-mode.ts`).

## Memoria en petición LLM

La compactación in-memory para el POST (`history[]`) sigue en `frontend/src/utils/chat-history-payload.ts`. La persistencia en DB guarda el texto completo del hilo activo.
