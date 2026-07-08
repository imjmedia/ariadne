/**
 * Suggested prompts for project/repo chat (architecture, reengineering, schema).
 */
export interface ChatPromptTemplate {
  id: string;
  label: string;
  message: string;
  hint?: string;
}

export const CHAT_PROMPT_TEMPLATES: ChatPromptTemplate[] = [
  {
    id: 'reengineering-media',
    label: 'Desacoplar medios',
    hint: 'Arquitectura multi-agente · reingeniería',
    message:
      'Analiza el acoplamiento en la creación de tipos de medio (sitios, indoors, urbanos) en backend y frontend. Necesitamos agregar nuevos medios con reglas distintas (ej. venta mínima, branding). Propón arquitectura desacoplada, archivos a tocar y fases de migración. No listes todo el esquema de BD.',
  },
  {
    id: 'reengineering-generic',
    label: 'Propuesta de reingeniería',
    hint: 'Router + auditoría',
    message:
      'Qué propones para desacoplar este dominio y poder extenderlo rápido? Incluye diagnóstico del código actual, propuesta objetivo, riesgos y quick wins.',
  },
  {
    id: 'schema-erd',
    label: 'Diagrama ERD',
    hint: 'Esquema Strapi/ORM',
    message: 'Muéstrame el diagrama entidad-relación del esquema de base de datos indexado (content-types Strapi y modelos ORM).',
  },
  {
    id: 'flow-impact',
    label: 'Impacto de un cambio',
    hint: 'Q&A con retrieve',
    message:
      'Si cambio la creación de medios en el backend, qué componentes, APIs y pantallas del frontend se verían afectados según el grafo?',
  },
];
