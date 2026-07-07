/**
 * Máscara de API key para respuestas públicas (primeros 4 + últimos 4 caracteres).
 */
export function maskApiKeyHint(key: string): string | null {
  const t = key.trim();
  if (!t) return null;
  if (t.length <= 8) return '••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
