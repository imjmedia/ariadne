import { describe, expect, it } from 'vitest';
import { parseStrapiSchemaJson } from './strapi-schema-extract';

describe('parseStrapiSchemaJson', () => {
  it('extrae attributes y relaciones', () => {
    const path = 'src/api/medio/content-types/medio/schema.json';
    const content = JSON.stringify({
      kind: 'collectionType',
      collectionName: 'medios',
      info: {
        singularName: 'medio',
        pluralName: 'medios',
        displayName: 'Medio',
      },
      attributes: {
        nombre: { type: 'string', required: true },
        pais: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'api::ubicacion.ubicacion',
        },
      },
    });
    const out = parseStrapiSchemaJson(path, content);
    expect(out?.name).toBe('medio');
    expect(out?.displayName).toBe('Medio');
    expect(out?.attributes).toHaveLength(2);
    expect(out?.attributes[1]?.target).toBe('api::ubicacion.ubicacion');
    expect(out?.attributesSummary).toContain('nombre:string');
    expect(out?.attributesSummary).toContain('pais:relation');
  });

  it('devuelve null si JSON inválido', () => {
    expect(
      parseStrapiSchemaJson('src/api/x/content-types/x/schema.json', '{ bad'),
    ).toBeNull();
  });
});
