import { describe, expect, it, vi } from 'vitest';
import { CredentialsService } from './credentials.service';

describe('CredentialsService.resolveRefForSync', () => {
  const repoCredId = '11111111-1111-1111-1111-111111111111';
  const userCredId = '22222222-2222-2222-2222-222222222222';
  const userId = 'user-zeferino';

  function serviceWithUserCred(): CredentialsService {
    const svc = new CredentialsService({ findOne: vi.fn() } as never);
    vi.spyOn(svc, 'findRefForUser').mockResolvedValue(userCredId);
    return svc;
  }

  it('prioriza credentialsRef del repo sobre la credencial del usuario', async () => {
    const svc = serviceWithUserCred();
    const ref = await svc.resolveRefForSync({
      repoCredentialsRef: repoCredId,
      provider: 'bitbucket',
      triggeredByUserId: userId,
    });
    expect(ref).toBe(repoCredId);
    expect(svc.findRefForUser).not.toHaveBeenCalled();
  });

  it('usa credencial del usuario solo si el repo no tiene credentialsRef', async () => {
    const svc = serviceWithUserCred();
    const ref = await svc.resolveRefForSync({
      repoCredentialsRef: null,
      provider: 'bitbucket',
      triggeredByUserId: userId,
    });
    expect(ref).toBe(userCredId);
    expect(svc.findRefForUser).toHaveBeenCalledWith(userId, 'bitbucket');
  });

  it('devuelve null si no hay credencial en repo ni del usuario', async () => {
    const svc = new CredentialsService({ findOne: vi.fn() } as never);
    vi.spyOn(svc, 'findRefForUser').mockResolvedValue(null);
    const ref = await svc.resolveRefForSync({
      repoCredentialsRef: '   ',
      provider: 'github',
      triggeredByUserId: userId,
    });
    expect(ref).toBeNull();
  });
});
