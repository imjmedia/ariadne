# RepoChat

Página de chat con el repositorio: preguntas en lenguaje natural → Cypher → FalkorDB.

## Layout (rediseño UX)

- **Una sola columna:** conversación a pantalla completa; sin split permanente ni pestañas móvil/chat+tools.
- **Análisis bajo demanda:** panel lateral (`ChatAnalysisSheet`) con 3 acciones frecuentes + acordeón «Más análisis».
- **Opciones avanzadas:** popover «Opciones» (modo de respuesta, alcance opcional, memoria compactada).
- **Cabecera compacta:** volver al repo, badges de modo/alcance, botones Análisis y Nueva conversación.

## Componentes

| Archivo | Rol |
|---------|-----|
| **RepoChat.tsx** | Estado, envío de chat y orquestación |
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

## Historial

`ChatConversationToolbar` sustituido por icono en cabecera + nota en popover Opciones. Ver `frontend/src/utils/chat-history-payload.ts`.
