/**
 * Extrae la sección Markdown «Archivos a tocar» para renderizarla colapsable en el chat.
 */

export type ArchivosATocarSplit = {
  before: string;
  section: { title: string; body: string } | null;
  after: string;
};

const HEADING_RE = /^(#{1,3})\s+(Archivos a tocar\b[^\n]*)$/im;

/**
 * Parte el markdown en: contenido previo, sección «Archivos a tocar» y resto.
 * La sección termina en el siguiente heading del mismo nivel o superior (`#`…`#{level}`).
 */
export function splitArchivosATocarSection(markdown: string): ArchivosATocarSplit {
  const text = markdown ?? '';
  const match = HEADING_RE.exec(text);
  if (!match || match.index === undefined) {
    return { before: text, section: null, after: '' };
  }

  const level = match[1].length;
  const title = match[2].trim();
  const before = text.slice(0, match.index).trimEnd();
  const afterHeading = text.slice(match.index + match[0].length).replace(/^\r?\n+/, '');

  const nextHeadingRe = new RegExp(`^#{1,${level}}\\s+`, 'm');
  const endMatch = nextHeadingRe.exec(afterHeading);

  if (endMatch && endMatch.index !== undefined) {
    return {
      before,
      section: { title, body: afterHeading.slice(0, endMatch.index).trimEnd() },
      after: afterHeading.slice(endMatch.index),
    };
  }

  return {
    before,
    section: { title, body: afterHeading.trimEnd() },
    after: '',
  };
}
