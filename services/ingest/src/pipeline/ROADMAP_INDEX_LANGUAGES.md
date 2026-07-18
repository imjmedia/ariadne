# Roadmap — indexación de lenguajes (fuera de alcance actual)

Ariadne prioriza **TypeORM + CSS + HTML al ~100%** del extractor actual. Estos lenguajes quedan planificados:

## Python (`.py`)

| Fase | Entregable |
|------|------------|
| P0 | Tree-sitter-python en ingest; `:Function`, `:Model` |
| P1 | SQLAlchemy (`__tablename__`, `Column`, `relationship`) → `RELATES_TO` |
| P2 | Django models / Alembic migrations (`INDEX_MIGRATIONS`) |

## Rust (`.rs`)

| Fase | Entregable |
|------|------------|
| P0 | Tree-sitter-rust; `struct`/`enum`/`fn` |
| P1 | Diesel / SQLx schema → `:Model` + relaciones |
| P2 | `impl` blocks vinculados a traits de persistencia |

## SQL suelto (`.sql`)

| Fase | Entregable |
|------|------------|
| P0 | `CREATE TABLE` + `FOREIGN KEY` → `:Model source=sql` |
| P1 | Vistas, índices, dialectos (PG/MySQL/SQLite) |
| P2 | Parser de migraciones TypeORM/SQL bajo `INDEX_MIGRATIONS=true` |

## Activación prevista

- Extensión en `sync-path-filter.ts` (hoy solo CSS/HTML fuera de JS/TS).
- Extractores dedicados (no mezclar con `static-asset-extract.ts`).
- Ampliar `SCHEMA_MODEL_SOURCES` solo cuando SQL esté en P0 completado.
