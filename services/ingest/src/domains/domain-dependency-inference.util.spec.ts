import { describe, expect, it } from 'vitest';
import { inferProjectDomainDependencies } from './domain-dependency-inference.util';

const catalog = [
  { id: 'd-platform', name: 'Plataforma' },
  { id: 'd-infra', name: 'Infraestructura' },
  { id: 'd-media', name: 'Media Manager' },
  { id: 'd-catalog', name: 'Catálogo' },
  { id: 'd-events', name: 'Eventos y memorias' },
];

describe('inferProjectDomainDependencies', () => {
  it('infiere Infraestructura desde dependencias npm', () => {
    const out = inferProjectDomainDependencies({
      projectDomainId: 'd-events',
      catalog,
      existingDependsOnDomainIds: [],
      packageDependencyNames: ['@aws-sdk/client-s3', 'ioredis'],
      workspaceEngineNames: [],
      composeServiceNames: [],
    });
    expect(out.some((x) => x.dependsOnDomainId === 'd-infra')).toBe(true);
  });

  it('infiere dominio custom de media desde workspace', () => {
    const out = inferProjectDomainDependencies({
      projectDomainId: 'd-events',
      catalog,
      existingDependsOnDomainIds: [],
      packageDependencyNames: [],
      workspaceEngineNames: ['media-engine', 'render-worker'],
      composeServiceNames: [],
    });
    expect(out.some((x) => x.dependsOnDomainId === 'd-media')).toBe(true);
  });

  it('no repite dominio del proyecto ni dependencias existentes', () => {
    const out = inferProjectDomainDependencies({
      projectDomainId: 'd-events',
      catalog,
      existingDependsOnDomainIds: ['d-infra'],
      packageDependencyNames: ['stripe'],
      workspaceEngineNames: [],
      composeServiceNames: [],
    });
    expect(out.some((x) => x.dependsOnDomainId === 'd-events')).toBe(false);
    expect(out.some((x) => x.dependsOnDomainId === 'd-infra')).toBe(false);
  });

  it('devuelve vacío sin señales', () => {
    const out = inferProjectDomainDependencies({
      projectDomainId: 'd-events',
      catalog,
      existingDependsOnDomainIds: [],
      packageDependencyNames: ['lodash'],
      workspaceEngineNames: ['api', 'web'],
      composeServiceNames: [],
    });
    expect(out).toEqual([]);
  });
});
