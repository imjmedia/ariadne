import { describe, expect, it } from 'vitest';
import {
  parseArchivosATocarSection,
  splitArchivosATocarSection,
} from './chat-archivos-section.util';

describe('splitArchivosATocarSection', () => {
  it('returns null section when heading is absent', () => {
    const md = '## Diagnóstico\n\nTodo bien.';
    expect(splitArchivosATocarSection(md)).toEqual({
      before: md,
      section: null,
      after: '',
    });
  });

  it('splits ## Archivos a tocar until the next ##', () => {
    const md = [
      '## Propuesta',
      '',
      'Hacer X.',
      '',
      '## Archivos a tocar',
      '',
      '| path | motivo |',
      '| --- | --- |',
      '| a.ts | refactor |',
      '',
      '## Evidencia',
      '',
      'Cite paths.',
    ].join('\n');

    const result = splitArchivosATocarSection(md);
    expect(result.before).toBe('## Propuesta\n\nHacer X.');
    expect(result.section).toEqual({
      title: 'Archivos a tocar',
      body: '| path | motivo |\n| --- | --- |\n| a.ts | refactor |',
    });
    expect(result.after).toBe('## Evidencia\n\nCite paths.');
  });

  it('keeps ### under the section and stops at ##', () => {
    const md = [
      '## Archivos a tocar',
      '',
      '### Frontend',
      '- a.tsx',
      '',
      '## Riesgos',
      'Alto',
    ].join('\n');

    const result = splitArchivosATocarSection(md);
    expect(result.section?.body).toContain('### Frontend');
    expect(result.section?.body).toContain('- a.tsx');
    expect(result.after).toBe('## Riesgos\nAlto');
  });

  it('accepts ### Archivos a tocar with a count suffix', () => {
    const md = 'Intro\n\n### Archivos a tocar (3)\n\n- a.ts\n\n## Fin';
    const result = splitArchivosATocarSection(md);
    expect(result.before).toBe('Intro');
    expect(result.section?.title).toBe('Archivos a tocar (3)');
    expect(result.section?.body).toBe('- a.ts');
    expect(result.after).toBe('## Fin');
  });

  it('takes the rest of the document when there is no following heading', () => {
    const md = '## Archivos a tocar\n\n- solo.ts';
    expect(splitArchivosATocarSection(md)).toEqual({
      before: '',
      section: { title: 'Archivos a tocar', body: '- solo.ts' },
      after: '',
    });
  });
});

describe('parseArchivosATocarSection', () => {
  it('parses GFM table with qué tocar/modificar column aliases', () => {
    const body = [
      '| path | repoId | qué tocar/modificar | símbolo |',
      '| --- | --- | --- | --- |',
      '| src/a.ts | repo-1 | Extraer validación | validate |',
      '| src/b.ts | repo-1 | Añadir tests | — |',
    ].join('\n');

    const parsed = parseArchivosATocarSection(body);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({
      path: 'src/a.ts',
      repoId: 'repo-1',
      queTocar: 'Extraer validación',
      simbolo: 'validate',
    });
    expect(parsed.rows[1]?.queTocar).toBe('Añadir tests');
  });

  it('maps motivo column to queTocar', () => {
    const body = ['| path | motivo |', '| --- | --- |', '| a.ts | refactor hook |'].join('\n');
    expect(parseArchivosATocarSection(body).rows[0]).toEqual({
      path: 'a.ts',
      queTocar: 'refactor hook',
    });
  });

  it('parses bullet list with repo inline and change hint', () => {
    const body = [
      '- `frontend/src/App.tsx` (repo: abc-123) — conectar nuevo endpoint',
      '- `backend/handler.ts` · mover lógica de dominio',
    ].join('\n');
    const parsed = parseArchivosATocarSection(body);
    expect(parsed.rows).toEqual([
      {
        path: 'frontend/src/App.tsx',
        repoId: 'abc-123',
        queTocar: 'conectar nuevo endpoint',
      },
      {
        path: 'backend/handler.ts',
        queTocar: 'mover lógica de dominio',
      },
    ]);
  });

  it('returns empty rows and preamble when body is plain prose', () => {
    const parsed = parseArchivosATocarSection('Sin archivos concretos en el índice.');
    expect(parsed.rows).toEqual([]);
    expect(parsed.preamble).toContain('Sin archivos');
  });
});
