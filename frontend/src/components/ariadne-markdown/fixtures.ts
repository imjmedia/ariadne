/**
 * Fixtures representativos del markdown que genera Ariadne (OBP multi-root).
 * Usados en compare.spec para validar el perfil TanStack antes de migrar chat/análisis.
 */
export const OBP_CHAT_ARCHIVOS_SECTION = `# Plan de cambio

Resumen del impacto en campañas.

## Archivos a tocar

| Archivo | Qué tocar |
|---------|-----------|
| \`src/api/campania/services/campania.js\` | Validar descuento máximo |
| \`src/pages/CampDetail.tsx\` | Mostrar límite en UI |

## Flujo

1. Usuario edita campaña
2. Backend valida en Strapi

\`\`\`mermaid
flowchart LR
  UI[CampDetail] --> API[Strapi campania]
\`\`\`
`;

export const OBP_LLM_EDGE_CASES = `
URLs sueltas: https://example.com/docs (TanStack no autolink — debe quedar literal).

**Negrita** y \`inline code\`.

- [ ] Tarea pendiente GFM
- [x] Tarea hecha

~~strike~~ texto
`;

export const ARIADNE_MARKDOWN_FIXTURES = {
  archivosSection: OBP_CHAT_ARCHIVOS_SECTION,
  llmEdgeCases: OBP_LLM_EDGE_CASES,
} as const;
