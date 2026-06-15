import { describe, expect, it } from 'vitest';
import { apiNameFromStrapiUid, extractStrapiUidReferences } from './strapi-uid-reference-extract';

describe('strapi-uid-reference-extract', () => {
  it('extractStrapiUidReferences from service/controller/db.query', () => {
    const src = `
      await strapi.service('api::campania.campania').create(data);
      strapi.controller('api::detailpauta.detailpauta');
      strapi.db.query('api::pauta.pauta').findMany();
    `;
    const uids = extractStrapiUidReferences(src);
    expect(uids).toContain('api::campania.campania');
    expect(uids).toContain('api::detailpauta.detailpauta');
    expect(uids).toContain('api::pauta.pauta');
  });

  it('apiNameFromStrapiUid', () => {
    expect(apiNameFromStrapiUid('api::campania.campania')).toBe('campania');
    expect(apiNameFromStrapiUid('invalid')).toBeNull();
  });
});
