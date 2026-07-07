import { describe, expect, it } from 'vitest';
import {
  wantsSchemaDatabaseQuestion,
  schemaOrmModelsCypher,
  schemaStrapiContentTypesCypher,
} from './chat-schema-question.util';

describe('wantsSchemaDatabaseQuestion', () => {
  it('detecta preguntas de diagrama/esquema de base de datos', () => {
    expect(wantsSchemaDatabaseQuestion('puedes darme el diagrama de base de datos que debería quedar?')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('dame el esquema de la base de datos')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('modelo de datos del proyecto')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('database schema diagram')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('quiero un ERD')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('content types de strapi')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('qué tablas y relaciones tiene la bd')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('estructura de la base de datos')).toBe(true);
  });

  it('empareja sustantivo de BD con término de esquema', () => {
    expect(wantsSchemaDatabaseQuestion('entidades en prisma')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('migraciones de la base de datos')).toBe(true);
  });

  it('no dispara con preguntas no relacionadas a esquema de BD', () => {
    expect(wantsSchemaDatabaseQuestion('esquema de colores del front')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('cómo se conecta a la base de datos')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('lista de componentes')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('qué endpoints expone el backend')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('')).toBe(false);
  });
});

describe('schema cypher builders', () => {
  it('modelos ORM excluyen fuentes que no son de persistencia', () => {
    const q = schemaOrmModelsCypher(100);
    expect(q).toContain("m.source IN ['prisma', 'typeorm']");
    expect(q).toContain('LIMIT 100');
  });

  it('content types filtran por projectId', () => {
    const q = schemaStrapiContentTypesCypher(50);
    expect(q).toContain(':StrapiContentType');
    expect(q).toContain('$projectId');
    expect(q).toContain('LIMIT 50');
  });
});
