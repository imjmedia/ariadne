---
id: nombre-del-modulo-o-componente
title: Nombre Legible
category: Componentes
last_updated: 2026-06-29
---

# [Nombre del Módulo o Componente]

> **AI Context Brief:** Breve resumen de una sola frase de qué hace esto y cuándo debe usarlo el agente.

## 1. Uso Básico (Quick Start)

```typescript
// Código limpio y directamente copiable por la IA sin explicaciones redundantes
import { MiComponente } from "@/components";

export const Example = () => <MiComponente variant="primary" />;
```

## 2. API & Contrato de Tipos (Specs)

| Propiedad | Tipo                      | Por Defecto | Descripción                |
| --------- | ------------------------- | ----------- | -------------------------- |
| variant   | `'primary' \| 'secondary'`| `'primary'` | Define el estilo visual.   |
| disabled  | `boolean`                 | `false`     | Bloquea la interacción.    |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** No envuelvas este componente en un contenedor con `overflow: hidden`.
- **Regla 2:** Las variantes secundarias solo deben usarse si ya existe una primaria en la misma vista.

---

<!--
GUÍA DE AUTORÍA (no se sirve a los agentes; este archivo se ignora en el manifest):

- Una página = un componente/módulo/concepto atómico. No mezcles temas.
- La carpeta de primer nivel define la `section` de la URI: docs://<carpeta>/<id>.
  Ej.: docs_mcp/componentes/button.md  ->  docs://componentes/button
- El `id` del frontmatter es el slug de la URI (si falta, se usa el nombre de archivo).
- El blockquote "AI Context Brief" alimenta el `summary` del manifest y la búsqueda.
- `get_component_api` extrae SOLO las secciones cuyo título coincide con:
    Uso Básico / Quick Start, API / Contrato / Tipos / Props / Specs, Decisiones / Restricciones.
  Mantén esos títulos para que la herramienta devuelva el contrato correcto.
-->
