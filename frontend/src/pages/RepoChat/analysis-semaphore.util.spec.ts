import { describe, expect, it } from 'vitest';
import { summarizeAnalysisMarkdown } from './analysis-semaphore.util';

describe('summarizeAnalysisMarkdown', () => {
  it('marks critical when red flags appear', () => {
    const result = summarizeAnalysisMarkdown('## Riesgos\n- 🔴 Secret expuesto en .env\n- crítico: SQL injection');
    expect(result.critical).toBeGreaterThan(0);
    expect(result.overall).toBe('critical');
  });

  it('marks warning when only medium issues', () => {
    const result = summarizeAnalysisMarkdown('Antipatrón detectado en duplicado de lógica');
    expect(result.warning).toBeGreaterThan(0);
    expect(result.overall).toBe('warning');
  });

  it('marks ok when positive signals only', () => {
    const result = summarizeAnalysisMarkdown('✅ Sin hallazgos de seguridad');
    expect(result.ok).toBeGreaterThan(0);
    expect(result.overall).toBe('ok');
  });
});
