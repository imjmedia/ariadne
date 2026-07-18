# Ariadne — Design System

> Fuente de verdad para UI del frontend (`frontend/`). Extraído de la implementación actual: tema **cosmic-night**, shadcn/ui **new-york**, Tailwind CSS 4.

## Identidad

| Atributo | Valor |
|---|---|
| Producto | Ariadne — mapa de arquitectura y conocimiento del código |
| Estética | SaaS denso, panel lateral, acento violeta/púrpura sobre fondos fríos |
| Tono | Técnico, confiable, orientado a ingeniería (no marketing) |
| Idioma UI | Español (labels, estados, ayuda) |

### Marca

Assets en `frontend/public/brand/`:

| Asset | Uso |
|---|---|
| `wordmark-light.png` / `wordmark-dark.png` | Logo horizontal (login, sidebar expandido) |
| `logo-light.png` / `logo-dark.png` | Mark cuadrado (sidebar colapsado) |
| `favicon.png` | Pestaña del navegador |

Componente: `AriadneLogo` (`frontend/src/components/brand/AriadneLogo.tsx`).

Variantes: `full` (login), `compact` (sidebar), `mark` / `icon` (rail colapsado).

Constantes: `frontend/src/constants/brand.ts`.

---

## Stack UI

| Capa | Tecnología |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Routing | React Router 7 |
| Estilos | Tailwind CSS 4 (`@import "tailwindcss"`) |
| Componentes base | shadcn/ui — estilo **new-york** (`frontend/components.json`) |
| Primitivos | Radix UI (`radix-ui`) |
| Tablas | TanStack Table + `DataTable` |
| Iconos nav | **Phosphor Icons** (`@phosphor-icons/react`) — duotone en sidebar |
| Iconos acciones | **Lucide React** — botones, header, formularios |
| Grafos | React Flow, vis-network (estilos custom en `index.css`) |
| Markdown | `react-markdown`, `marked`, diagramas Mermaid |

---

## Tokens

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/index.css` | Tema shadcn base (`:root` / `.dark`), `@theme inline`, utilidades de grafo |
| `frontend/src/styles/vars.css` | Extensiones semánticas Ariadne (success, warning, z-index, transiciones) |

**Regla:** no duplicar tokens. Cambios de paleta shadcn → `index.css`. Extensiones de producto → `vars.css`.

### Paleta (OKLCH)

Tema **cosmic-night**: violeta como `--primary`, fondos fríos con tinte púrpura.

| Token | Light | Uso |
|---|---|---|
| `--background` | `oklch(0.973 0.013 286)` | Fondo app |
| `--foreground` | `oklch(0.302 0.057 282)` | Texto principal |
| `--primary` | `oklch(0.542 0.179 288)` | CTA, activo sidebar, links |
| `--card` | blanco | Paneles, header |
| `--muted` / `--muted-foreground` | grises violeta | Texto secundario, fondos sutiles |
| `--destructive` | rojo-naranja | Errores, estados failed |
| `--border` | `oklch(0.912 0.022 286)` | Bordes, inputs |
| `--ring` | = primary | Focus visible |

Modo oscuro (`.dark`): fondo `oklch(0.174 0.023 284)`, primary más claro `oklch(0.716 0.160 290)`.

Extensiones en `vars.css`:

| Token | Uso |
|---|---|
| `--foreground-muted`, `--foreground-subtle` | Jerarquía tipográfica |
| `--primary-hover` | Hover en botones primary |
| `--success` / `--warning` | KPIs, badges de estado, trends |
| `--shadow-glow` | Glow sutil en login / hero |
| `--transition-fast/base/slow` | 150 / 200 / 300 ms |
| `--z-dropdown` … `--z-tooltip` | Capas modales |

### Tipografía

| Rol | Familia | Tailwind |
|---|---|---|
| UI | Inter | `--font-sans` |
| Código | JetBrains Mono | `--font-mono` |
| Serif (raro) | Georgia | `--font-serif` |

Escala habitual:

- Títulos página: `text-xl`–`text-2xl font-semibold tracking-tight`
- KPI valor: `text-3xl font-bold tabular-nums tracking-tight`
- Cuerpo: `text-sm leading-relaxed`
- Meta / footer: `text-xs text-[var(--foreground-muted)]`
- Labels form: `text-sm font-medium`

### Radio y sombras

- `--radius`: `0.5rem` (8px) — botones, inputs, cards estándar
- Cards destacadas (dashboard, login): `rounded-3xl`
- Icon chips: `rounded-2xl`
- Pills / badges: `rounded-full` o `rounded-md`
- Sombras: escala `--shadow-xs` … `--shadow-2xl`; cards con `shadow-sm hover:shadow-md`

### Tema claro / oscuro

- Clase `.dark` en `<html>` (ver `frontend/src/lib/theme.ts`)
- Preferencia: `light` | `dark` | `system` — storage key `ariadne-theme`
- Componente: `ThemeToggle` — `layout="icon"` (header) o `layout="pill"` (login)
- Logos: `<img>` con `dark:hidden` / `hidden dark:block`

---

## Layout

### App shell (`Layout.tsx`)

```
┌─────────────┬──────────────────────────────────────┐
│  Sidebar    │  Header (h-16, blur, border-b)       │
│  (lg+)      │  [search]          [theme][bell][av] │
│             ├──────────────────────────────────────┤
│  colapsable │  Main (p-3 sm:p-4 lg:p-8)            │
│  18rem max  │  max-w-[1600px] mx-auto              │
└─────────────┴──────────────────────────────────────┘
```

- Altura: `100dvh`, safe-area insets en móvil
- Sidebar desktop: `SidebarModern`, colapsable a rail icon-only
- Móvil: drawer overlay `bg-black/60 backdrop-blur-sm`
- Contenido: `overflow-y-auto`, ancho máximo **1600px**

### Sidebar (`SidebarModern.tsx`)

- Grupos: **Gobierno**, **Ingeniería**, **Plataforma**
- Item activo: barra lateral + tinte primary; rail colapsado → círculo `bg-[var(--primary)] text-white`
- Iconos Phosphor con peso duotone
- Footer fijo: Ayuda

### Header (`AppShellHeader.tsx`)

- Izquierda: `HeaderSearch` (búsqueda global)
- Derecha: botones circulares `size-9 rounded-full border` — tema, notificaciones, avatar
- Estilo referencia: círculos con borde sutil, sin sombra fuerte

### Login (página pública)

- Grid `lg:grid-cols-2`, card centrada `max-w-md` / `max-w-lg`
- Hero: gradiente radial `--primary` en la parte superior
- Card login: `rounded-3xl`, borde `--primary/25`, `backdrop-blur-md`, sombra profunda
- Badge outline: “Acceso sin contraseña”

---

## Componentes

### Ubicación

```
frontend/src/components/
├── ui/           # shadcn: Button, Card, Input, Select, Badge, Dialog, Table…
├── layout/       # SidebarModern
├── brand/        # AriadneLogo
├── atoms/        # Avatar
├── data-table/   # DataTable (TanStack)
├── dashboard/    # DashboardMetricCard, DashboardWeeklyBarsCard
├── analyze/      # AnalyzeReportMetaBadges, AnalyzeScopeFields
└── …             # dominio: repos, users, projects
```

Import alias: `@/components/ui/*`, `@/lib/utils` (`cn()`).

### Button

Variantes: `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`

Tamaños: `default` (h-9), `sm`, `lg`, `xs`, `icon`, `icon-sm`, `icon-lg`

- Primary: `bg-[var(--primary)]`, hover `--primary-hover`, `shadow-sm`
- Focus: `ring-2 ring-[var(--ring)] ring-offset-2`

### Card

- Default: `rounded-[var(--radius)]`, `border-[var(--card-border)]`, `bg-[var(--card)]`
- Dashboard / login: override a `rounded-3xl` + sombra
- Header con `border-b`, footer con `border-t`

### Badge / StatusBadge

Variantes Badge: `default`, `secondary`, `destructive`, `warning`, `outline`

`StatusBadge` mapea estados de jobs/repos:

| Status | Variante | Label |
|---|---|---|
| queued, pending | secondary | En cola |
| running, syncing | warning | Procesando |
| completed, ready | default | Completado |
| failed, error | destructive | Error |

### DataTable

- Filtro global arriba (`Input`)
- Ordenación por columna (iconos Lucide ArrowUp/Down)
- Scroll horizontal en tablas anchas
- Meta por columna: `headerClassName`, `cellClassName`

### DashboardMetricCard

- `rounded-3xl border p-5 shadow-sm hover:shadow-md`
- Icon chip `size-10 rounded-2xl` con tonos: `primary` | `success` | `muted`
- Trend pill: verde (up), rojo (down), neutro (border muted)

---

## Patrones de color semántico

Usar tokens, no hex sueltos:

```tsx
// ✅ Correcto
className="text-[var(--foreground-muted)] bg-[var(--card)] border-[var(--border)]"

// ✅ Mezclas OKLCH para tintes
className="bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]"

// ❌ Evitar
className="text-gray-500 bg-slate-800"
```

Excepción documentada: controles vis-network en `index.css` usan slate `#1e293b` / `#334155` para neutralizar assets verdes del library.

---

## Iconografía

| Contexto | Librería | Notas |
|---|---|---|
| Sidebar nav | Phosphor | Duotone, tamaño ~20px |
| Botones, header, forms | Lucide | `strokeWidth={1.75}` habitual |
| Empty states | Lucide | Tamaño contextual |

No mezclar librerías en el mismo control (ej. un botón con icono Phosphor + Lucide en la misma fila de acciones).

---

## Accesibilidad

- `:focus-visible` global: `outline 2px solid var(--ring)`
- Botones icon-only: siempre `aria-label`
- Títulos de página: preferir `<h1>` visible o `sr-only` (login)
- Contraste: primary sobre card cumple en ambos temas
- Touch: `touch-manipulation` en controles móviles del header/sidebar
- Safe areas: `env(safe-area-inset-*)` en body, header, main

---

## Contenido rico

| Componente | Uso |
|---|---|
| `MarkdownBlock` | Bloques markdown en chat/ayuda |
| `MermaidDiagram` / `MermaidZoomViewport` | Diagramas en reportes |
| `DocViewer` | Manual / docs embebidos |

Código inline: `--font-mono`. Bloques de código: fondo `--muted`, borde `--border`.

---

## Convenciones al extender UI

1. **Reutilizar** componentes en `ui/` antes de crear nuevos primitivos.
2. **Tokens CSS** (`var(--*)`) en lugar de colores Tailwind arbitrarios.
3. **cn()** para clases condicionales; no concatenar strings a mano.
4. **JSDoc** en componentes exportados (convención del repo).
5. **Nuevos shadcn**: `npx shadcn@latest add <component>` desde `frontend/`; revisar que usen variables del tema.
6. **README** de la carpeta del componente si se añade módulo nuevo con lógica propia.
7. **No** importar Kreo registry en runtime — el frontend es shadcn autónomo; Kreo solo se detecta en el grafo de repos indexados (`DesignSystemLinkService`).

---

## Referencias rápidas

| Recurso | Ruta |
|---|---|
| Tema base | `frontend/src/index.css` |
| Tokens extendidos | `frontend/src/styles/vars.css` |
| Config shadcn | `frontend/components.json` |
| Shell | `frontend/src/components/Layout.tsx` |
| README frontend | `frontend/README.md` |
| MCP design tokens | herramienta `extract_design_tokens` (repos indexados) |
