import { describe, expect, it } from 'vitest';
import {
  parseIntegrationHandoffMessage,
  wantsIntegrationHandoffQuestion,
} from './integration-handoff-message.util.js';

const SAMPLE = `## Handoff de integración \`NEW-LEG-04\`

**Proyecto origen (NEW):** Micro Servicio de costos
**Título:** Visualización de costos asociados en el previsualizador de medios del catálogo
**Actor:** Ejecutivo de ventas

### Descripción

Como ejecutivo de ventas, cuando abro el previsualizador de un medio desde el catálogo, necesito ver el listado de costos asociados.

### Criterios de aceptación
- El previsualizador muestra costos asociados
- Solo nombres, sin montos
- Solo desde catálogo

---

Analiza qué cambios se requieren en el codebase brownfield.`;

describe('parseIntegrationHandoffMessage', () => {
  it('parses handoff id, title, description and AC', () => {
    const p = parseIntegrationHandoffMessage(SAMPLE);
    expect(p).not.toBeNull();
    expect(p!.handoffId).toBe('NEW-LEG-04');
    expect(p!.title).toContain('costos asociados');
    expect(p!.description).toContain('previsualizador');
    expect(p!.acceptanceCriteria).toHaveLength(3);
  });
});

describe('wantsIntegrationHandoffQuestion', () => {
  it('detects by message structure', () => {
    expect(wantsIntegrationHandoffQuestion(SAMPLE)).toBe(true);
  });

  it('detects by integrationHandoffId', () => {
    expect(wantsIntegrationHandoffQuestion('hola', { integrationHandoffId: 'NEW-LEG-01' })).toBe(true);
  });

  it('detects by chatMode', () => {
    expect(wantsIntegrationHandoffQuestion('hola', { chatMode: 'integration_handoff' })).toBe(true);
  });
});
