import { describe, expect, it } from 'vitest';
import {
  buildErDiagramMermaid,
  modelFieldSummaryToMermaidAttributes,
  strapiAttributesSummaryToMermaidAttributes,
} from './er-diagram-mermaid.util';

describe('er-diagram-mermaid.util', () => {
  it('convierte fieldSummary TypeORM a atributos Mermaid', () => {
    const attrs = modelFieldSummaryToMermaidAttributes(
      JSON.stringify([
        'id:PrimaryGeneratedColumn(uuid)',
        'eventId',
        'name:Column({ type: varchar, length: 120 })',
        'createdAt:CreateDateColumn()',
      ]),
    );
    expect(attrs).toContain('    string id PK');
    expect(attrs).toContain('    string eventId FK');
    expect(attrs.some((l) => l.includes('name'))).toBe(true);
    expect(attrs).toContain('    datetime createdAt');
  });

  it('convierte attributesSummary Strapi a atributos Mermaid', () => {
    const attrs = strapiAttributesSummaryToMermaidAttributes('nombre:string;pais:relation(manyToOne->api::pais.pais)');
    expect(attrs.some((l) => l.includes('nombre'))).toBe(true);
    expect(attrs.some((l) => l.includes('pais') && l.includes('relation'))).toBe(true);
  });

  it('incluye bloques de entidad con campos además de relaciones', () => {
    const models = [
      {
        name: 'Attendee',
        fieldSummary: JSON.stringify(['id', 'eventId', 'name']),
      },
      {
        name: 'Event',
        fieldSummary: JSON.stringify(['id', 'name']),
      },
    ];
    const { diagram } = buildErDiagramMermaid({
      contentTypes: [],
      ctRel: [],
      models,
      modelRel: [],
    });

    expect(diagram).toContain('erDiagram');
    expect(diagram).toContain('Attendee {');
    expect(diagram).toContain('string id PK');
    expect(diagram).toContain('string eventId FK');
    expect(diagram).toContain('Event {');
    expect(diagram).toContain('Attendee ||--o{ Event');
  });
});
