# Cobertura del indexador (orientativa)

No hay métrica automática de % por repo; esta matriz describe **qué extrae el pipeline hoy** tras sync + resync.

## Alcance P0 (objetivo ~100%)

### TypeORM

| Capacidad | Estado |
|-----------|--------|
| `@Entity` / `@Embeddable` → `:Model` `source=typeorm` | ✅ |
| `tableName`, `embeddable`, `indexSummary` (`@Index`/`@Unique`) | ✅ |
| Columnas: `@Column`, `@Primary*`, `@CreateDateColumn`, `@UpdateDateColumn`, … | ✅ |
| `@Embedded(() => Type)` en `fieldSummary` | ✅ |
| Relaciones: `@ManyToOne`/`@OneToOne`/`@OneToMany`/`@ManyToMany` | ✅ |
| `@JoinColumn`, `@JoinTable`, `relationKind` en `RELATES_TO` | ✅ |
| Inferencia FK: `eventId` + propiedad `event: Event` | ✅ |
| ERD chat (decoradores + inferencia en `typeorm-schema.util`) | ✅ |

Fuera de P0 (roadmap): `EntitySchema`, enums TS nativos, STI (`@ChildEntity`), migraciones bajo `INDEX_MIGRATIONS=1`.

### CSS / SCSS

| Capacidad | Estado |
|-----------|--------|
| `:StaticAsset` `kind=css` | ✅ |
| Custom properties, SCSS `$vars`, class/id selectors | ✅ |
| `@media`, `@keyframes`, `@layer`, `@import`, `@font-face` | ✅ |
| `detailJson` en grafo + embeddings | ✅ |

### HTML

| Capacidad | Estado |
|-----------|--------|
| `:StaticAsset` `kind=html` | ✅ |
| tags, ids, classes, links, scripts, stylesheets | ✅ |
| form fields, meta, landmarks, `<title>` | ✅ |
| `detailJson` en grafo + embeddings | ✅ |

## Otras fuentes de esquema

| Fuente | Entidades | Relaciones ERD | Metadatos columna |
|--------|-----------|----------------|-------------------|
| **Prisma** (DMMF) | ✅ | ✅ | ✅ ~95% |
| **Strapi** | ✅ content-types | ✅ attributes | ✅ ~80% |

## Lenguajes / formatos (resto)

| Extensión | Grafo | Embeddings | Notas |
|-----------|-------|------------|-------|
| `.ts/.tsx/.js/.jsx` | AST Tree-sitter | Function, Component | ~85% stack JS |
| `.prisma` | prisma-extract | Model | ~95% |
| `.md` | `:MarkdownDoc` | MarkdownDoc | ~90% |
| `.mdx` Storybook | `:StorybookDoc` | StorybookDoc | ~70% |

**Roadmap (no indexados hoy):** Python, Rust, SQL suelto → `ROADMAP_INDEX_LANGUAGES.md`.  
**No indexados por defecto:** tests, e2e, `migrations/` (override `INDEX_MIGRATIONS=1`).

## Cómo materializar el 100% en un repo

1. **Deploy + resync** del servicio ingest tras merge.
2. Chat esquema BD: `prisma` + `typeorm` vía `SCHEMA_MODEL_SOURCES` (sin SQL suelto hasta roadmap P0).
3. CSS/HTML entran por `sync-path-filter` (`.css`, `.scss`, `.html`, `.htm`).
