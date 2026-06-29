import { describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';

describe('SyncService.phaseDependencyAnalysis', () => {
  const invoke = (provider: {
    getFileContent?: (...args: unknown[]) => Promise<string>;
    getFileContentSafe?: (...args: unknown[]) => Promise<string | null>;
  }) =>
    (
      SyncService.prototype as unknown as {
        phaseDependencyAnalysis: (
          p: typeof provider,
          owner: string,
          repo: string,
          ref: string,
          credentialsRef?: string | null,
        ) => Promise<string | null>;
      }
    ).phaseDependencyAnalysis.call({}, provider, 'kreodevs', 'theforge', 'main', null);

  it('binds getFileContentSafe so provider methods keep this', async () => {
    const getFileContent = vi.fn().mockResolvedValue(
      JSON.stringify({ dependencies: { react: '^18.0.0' }, devDependencies: {} }),
    );
    const getFileContentSafe = vi.fn(async function (this: { getFileContent: typeof getFileContent }) {
      return this.getFileContent('kreodevs', 'theforge', 'main', 'package.json', null);
    });

    const provider = { getFileContent, getFileContentSafe };

    const result = await invoke(provider);

    expect(getFileContentSafe).toHaveBeenCalledTimes(1);
    expect(getFileContent).toHaveBeenCalledWith(
      'kreodevs',
      'theforge',
      'main',
      'package.json',
      null,
    );
    expect(result).toContain('react');
  });

  it('falls back to getFileContent when getFileContentSafe is absent', async () => {
    const getFileContent = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ dependencies: { lodash: '4' } }));

    const result = await invoke({ getFileContent });

    expect(getFileContent).toHaveBeenCalledWith(
      'kreodevs',
      'theforge',
      'main',
      'package.json',
      null,
    );
    expect(result).toContain('lodash');
  });
});
