import { describe, expect, it } from 'vitest';
import {
  formatHandoffAuditErrorHint,
  formatHandoffAuditFailureAnswer,
} from './handoff-audit-error.util.js';

describe('formatHandoffAuditErrorHint', () => {
  it('maps fetch failed to LLM connectivity hint', () => {
    expect(formatHandoffAuditErrorHint('fetch failed')).toContain('proveedor LLM');
  });

  it('maps missing API key', () => {
    expect(formatHandoffAuditErrorHint('LLM sin API key')).toContain('Proveedores IA');
  });

  it('builds full failure answer', () => {
    const msg = formatHandoffAuditFailureAnswer('fetch failed');
    expect(msg).toContain('No pude completar el análisis del handoff');
    expect(msg).toContain('fetch failed');
  });
});
