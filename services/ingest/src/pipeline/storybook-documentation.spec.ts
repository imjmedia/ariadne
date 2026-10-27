import { describe, it, expect } from 'vitest';
import { parseProjectMarkdown } from './storybook-documentation';

describe('storybook-documentation (Project Markdown)', () => {
  it('extrae nombres de componentes y servicios desde encabezados y código inline', () => {
    const md = `
# UserProfile Component

Este documento detalla la arquitectura de \`UserProfile\` y su interacción con \`AuthService\`.

## PaymentModal

Permite procesar el pago invocando \`StripePaymentGateway\`.

### Notas de implementación
Usa el hook \`usePayment\` internamente.
    `;

    const result = parseProjectMarkdown('docs/UserProfile.md', md);

    expect(result).toBeDefined();
    expect(result?.titleHint).toBe('UserProfile Component');

    const linked = result?.linkedComponentNames ?? [];
    expect(linked).toContain('UserProfile');
    expect(linked).toContain('AuthService');
    expect(linked).toContain('PaymentModal');
    expect(linked).toContain('StripePaymentGateway');
  });

  it('no confunde palabras comunes en mayúsculas como componentes', () => {
    const md = `
# Guía de API

Para hacer peticiones \`HTTP\` a la \`REST\` \`API\` consulta el \`JSON\` y el \`UUID\`.
El componente principal es \`OrderSummary\`.
    `;

    const result = parseProjectMarkdown('docs/api.md', md);

    expect(result).toBeDefined();
    const linked = result?.linkedComponentNames ?? [];

    expect(linked).toContain('OrderSummary');
    expect(linked).not.toContain('HTTP');
    expect(linked).not.toContain('REST');
    expect(linked).not.toContain('API');
    expect(linked).not.toContain('JSON');
    expect(linked).not.toContain('UUID');
  });
});
