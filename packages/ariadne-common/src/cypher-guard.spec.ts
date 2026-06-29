/**
 * @fileoverview Tests for read-only Cypher guard.
 * Run: node --experimental-strip-types --test packages/ariadne-common/src/cypher-guard.spec.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLimitIfMissing,
  guardCypherQuery,
  injectProjectScope,
  queryHasLimit,
  queryReferencesProjectId,
  validateReadOnlyCypher,
  CypherGuardError,
} from './cypher-guard.ts';

describe('validateReadOnlyCypher', () => {
  it('allows read MATCH queries', () => {
    assert.doesNotThrow(() =>
      validateReadOnlyCypher(
        'MATCH (f:Function) WHERE NOT EXISTS { (f)<-[:CALLS]-() } RETURN f.name',
      ),
    );
  });

  for (const blocked of ['MERGE', 'CREATE', 'DELETE', 'SET', 'REMOVE', 'DROP'] as const) {
    it(`blocks ${blocked}`, () => {
      assert.throws(
        () => validateReadOnlyCypher(`${blocked} (n:File)`),
        (err: unknown) => err instanceof CypherGuardError && err.clause === blocked,
      );
    });
  }

  it('blocks CALL { subquery', () => {
    assert.throws(
      () => validateReadOnlyCypher('MATCH (n) CALL { WITH n RETURN n } RETURN n'),
      (err: unknown) => err instanceof CypherGuardError,
    );
  });

  it('rejects empty query', () => {
    assert.throws(() => validateReadOnlyCypher('   '), CypherGuardError);
  });
});

describe('injectProjectScope', () => {
  it('does not inject when projectId already referenced', () => {
    assert.equal(
      queryReferencesProjectId('MATCH (n {projectId: $pid}) RETURN n'),
      true,
    );
    const { query, injected } = injectProjectScope(
      'MATCH (n {projectId: $pid}) RETURN n',
      'abc',
    );
    assert.equal(injected, false);
    assert.equal(query, 'MATCH (n {projectId: $pid}) RETURN n');
  });

  it('adds WHERE after MATCH when missing', () => {
    const { query, injected } = injectProjectScope('MATCH (n:Function) RETURN n.name', 'p1');
    assert.equal(injected, true);
    assert.match(query, /WHERE n\.projectId = \$projectId/);
  });

  it('extends existing WHERE clause', () => {
    const { query, injected } = injectProjectScope(
      'MATCH (n:Function) WHERE n.name = $name RETURN n',
      'p1',
    );
    assert.equal(injected, true);
    assert.match(query, /WHERE \(n\.projectId = \$projectId\) AND n\.name = \$name/);
  });

  it('uses MATCH alias and keeps space before RETURN/ORDER', () => {
    const { query, injected } = injectProjectScope(
      'MATCH (f:Function) RETURN f.name AS name, f.path AS path LIMIT 5',
      'p1',
    );
    assert.equal(injected, true);
    assert.match(query, /WHERE f\.projectId = \$projectId RETURN/);
    assert.doesNotMatch(query, /projectIdRETURN/);

    const ordered = injectProjectScope('MATCH (f:Function) ORDER BY f.name RETURN f', 'p1');
    assert.match(ordered.query, /WHERE f\.projectId = \$projectId ORDER BY/);
    assert.doesNotMatch(ordered.query, /projectIdORDER/);
  });
});

describe('appendLimitIfMissing', () => {
  it('appends LIMIT when absent', () => {
    const { query, appended } = appendLimitIfMissing('MATCH (n) RETURN n', 25);
    assert.equal(appended, true);
    assert.match(query, /LIMIT 25$/);
  });

  it('preserves existing LIMIT', () => {
    assert.equal(queryHasLimit('MATCH (n) RETURN n LIMIT 10'), true);
    const { appended } = appendLimitIfMissing('MATCH (n) RETURN n LIMIT 10', 50);
    assert.equal(appended, false);
  });
});

describe('guardCypherQuery', () => {
  it('returns params with projectId and guarded query', () => {
    const result = guardCypherQuery('MATCH (n:Function) RETURN n.name', {
      projectId: 'proj-1',
      limit: 10,
    });
    assert.equal(result.params.projectId, 'proj-1');
    assert.equal(result.injectedProjectScope, true);
    assert.equal(result.appendedLimit, true);
    assert.match(result.query, /LIMIT 10$/);
  });
});
