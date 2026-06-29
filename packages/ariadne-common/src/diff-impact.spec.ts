/**
 * @fileoverview Tests for diff parsing and risk classification.
 * Run: node --experimental-strip-types --test packages/ariadne-common/src/diff-impact.spec.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDetectChangesResult,
  classifySymbolImpact,
  gitDiffCommand,
  parseChangedFilesFromDiff,
  parseDiffMode,
  parseDiffSymbols,
} from './diff-impact.ts';

describe('parseDiffMode', () => {
  it('defaults to staged', () => {
    assert.equal(parseDiffMode(undefined), 'staged');
    assert.equal(parseDiffMode(''), 'staged');
  });

  it('parses unstaged and all', () => {
    assert.equal(parseDiffMode('unstaged'), 'unstaged');
    assert.equal(parseDiffMode('ALL'), 'all');
  });
});

describe('gitDiffCommand', () => {
  it('maps modes to git commands', () => {
    assert.equal(gitDiffCommand('staged'), 'git diff --cached');
    assert.equal(gitDiffCommand('unstaged'), 'git diff');
    assert.equal(gitDiffCommand('all'), 'git diff HEAD');
  });
});

describe('parseChangedFilesFromDiff', () => {
  it('extracts paths from diff headers', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n');
    assert.deepEqual(parseChangedFilesFromDiff(diff), ['src/foo.ts']);
  });
});

describe('parseDiffSymbols', () => {
  it('classifies removed, added, and edited symbols', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '-function keep() {}',
      '-function gone() {}',
      '+function keep() { return 1; }',
      '+function fresh() {}',
    ].join('\n');
    const parsed = parseDiffSymbols(diff);
    assert.deepEqual(parsed.edited, ['keep']);
    assert.deepEqual(parsed.removed, ['gone']);
    assert.deepEqual(parsed.added, ['fresh']);
  });
});

describe('classifySymbolImpact', () => {
  it('marks deletion with dependents as ALTO', () => {
    const r = classifySymbolImpact('Eliminación', 3);
    assert.equal(r.risk, 'ALTO');
  });

  it('marks modification with many dependents as ALTO', () => {
    const r = classifySymbolImpact('Modificación', 10);
    assert.equal(r.risk, 'ALTO');
  });
});

describe('buildDetectChangesResult', () => {
  it('aggregates summary counts', () => {
    const diff = [
      '-function gone() {}',
      '+function fresh() {}',
    ].join('\n');
    const counts = new Map<string, number>([['gone', 2], ['fresh', 0]]);
    const result = buildDetectChangesResult('staged', diff, counts);
    assert.equal(result.summary.high, 1);
    assert.equal(result.summary.low, 1);
    assert.equal(result.affectedSymbols.length, 2);
  });
});
