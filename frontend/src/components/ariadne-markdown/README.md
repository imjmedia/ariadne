# Ariadne Markdown

Capa unificada de renderizado markdown en el frontend.

## Motores

| Engine | Paquete | Uso actual |
|--------|---------|------------|
| **`tanstack`** | `@tanstack/markdown/react` | Spike: **DocViewer** (Ayuda) |
| **`legacy`** | `react-markdown` + `remark-gfm` | Chat, informes de análisis |

## API

```tsx
import { AriadneMarkdown } from '@/components/ariadne-markdown';

<AriadneMarkdown
  content={md}
  variant="docs"
  engine="tanstack"
  renderDocLink={({ href, children }) => <CustomLink href={href}>{children}</CustomLink>}
/>
```

Variantes: `docs` | `chat` | `analysis` (clases prose en `markdown-prose.ts`).

## Spike / comparación

- **`fixtures.ts`** — markdown tipo OBP (tabla Archivos a tocar, mermaid, GFM tasks).
- **`compare.spec.ts`** — valida que TanStack parsea el corpus antes de migrar chat.

```bash
npm run test:unit -- src/components/ariadne-markdown/compare.spec.ts
```

## Próximos pasos

1. Validar visualmente Ayuda (`/ayuda/*`) con `engine="tanstack"`.
2. Pasar corpus real de chat OBP por fixtures + QA side-by-side.
3. Migrar `ChatAssistantContent` cuando `business_logic` / tablas LLM pasen QA.
4. `AnalysisMarkdownReport` al final (semáforos en `tr`/`li`).
5. Opcional: `streamingMarkdownExtension` cuando el chat use SSE.

## Referencias

- [TanStack Markdown](https://tanstack.com/markdown/latest)
- Perfil de sintaxis: no autolinks, GFM tables/tasks/strike soportados en subset documentado.
