import { describe, expect, it } from 'vitest';
import {
  isCodigoMuertoEntryPath,
  isCodigoMuertoInfrastructurePath,
} from './codigo-muerto-path.util';

describe('isCodigoMuertoInfrastructurePath', () => {
  it('excludes monorepo manifests and build configs', () => {
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/package.json')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/postcss.config.js')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/index.html')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/README.md')).toBe(true);
  });

  it('excludes Vite entry points and ambient types in monorepos', () => {
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/src/main.tsx')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/planner-panel/src/main.tsx')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/src/vite-env.d.ts')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('src/global.d.ts')).toBe(true);
  });

  it('excludes root and nested tsconfig', () => {
    expect(isCodigoMuertoInfrastructurePath('tsconfig.json')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/api/tsconfig.app.json')).toBe(true);
  });

  it('does not exclude regular source modules', () => {
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/src/routes/pages/photos-page.tsx')).toBe(
      false,
    );
    expect(isCodigoMuertoInfrastructurePath('src/utils/format.ts')).toBe(false);
    expect(isCodigoMuertoInfrastructurePath('apps/planner-panel/src/components/catalog-form-panel.tsx')).toBe(
      false,
    );
  });

  it('keeps schema relational rag virtual doc', () => {
    expect(isCodigoMuertoInfrastructurePath('graph-internal/relational-schema-rag-index.md')).toBe(
      false,
    );
    expect(isCodigoMuertoInfrastructurePath('ariadne-internal/relational-schema-rag-index.md')).toBe(
      false,
    );
  });
});

describe('isCodigoMuertoEntryPath', () => {
  it('matches monorepo src entry files', () => {
    expect(isCodigoMuertoEntryPath('apps/foo/src/main.tsx')).toBe(true);
    expect(isCodigoMuertoEntryPath('apps/foo/src/index.tsx')).toBe(true);
    expect(isCodigoMuertoEntryPath('src/App.tsx')).toBe(true);
  });

  it('does not match regular modules', () => {
    expect(isCodigoMuertoEntryPath('apps/foo/src/components/Button.tsx')).toBe(false);
  });
});
