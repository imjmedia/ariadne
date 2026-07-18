import { describe, expect, it } from 'vitest';
import { isCodigoMuertoInfrastructurePath } from './codigo-muerto-path.util';

describe('isCodigoMuertoInfrastructurePath', () => {
  it('excludes monorepo manifests and build configs', () => {
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/package.json')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/postcss.config.js')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/index.html')).toBe(true);
    expect(isCodigoMuertoInfrastructurePath('apps/attendee-app/README.md')).toBe(true);
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
