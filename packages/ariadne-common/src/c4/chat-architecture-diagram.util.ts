/** Detecta preguntas sobre diagrama C4 / arquitectura del sistema. */
export function wantsArchitectureDiagramQuestion(message: string): boolean {
  const q = message.toLowerCase();
  if (/\b(c4|diagrama\s+de\s+arquitectura|architecture\s+diagram)\b/.test(q)) return true;
  if (/\b(muestra|genera|ver|dame).{0,40}\b(diagrama|mapa).{0,40}\b(arquitectura|contenedor|contexto)\b/.test(q)) {
    return true;
  }
  if (/\bcontainer\s+diagram\b/.test(q)) return true;
  if (/\bcontext\s+diagram\b/.test(q)) return true;
  return false;
}
