import { describe, expect, it } from 'vitest';
import { formatGitHubApiError } from './github.service';

describe('formatGitHubApiError', () => {
  it('returns actionable message for rate limit 403', () => {
    const msg = formatGitHubApiError(
      403,
      'API rate limit exceeded for 187.213.96.82. Authenticated requests get a higher rate limit.',
    );
    expect(msg).toContain('403');
    expect(msg).toContain('GITHUB_TOKEN');
    expect(msg).toContain('/credentials');
  });

  it('returns auth hint for 401', () => {
    const msg = formatGitHubApiError(401, 'Bad credentials');
    expect(msg).toContain('401');
    expect(msg).toContain('credentialsRef');
  });

  it('passes through other errors', () => {
    const msg = formatGitHubApiError(404, 'Not Found');
    expect(msg).toBe('GitHub API 404: Not Found');
  });
});
