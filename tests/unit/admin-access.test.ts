import { describe, expect, it, vi } from 'vitest';
import { verifyOwner, type AccessEnv } from '../../admin-worker/src/access';

const env: AccessEnv = {
  TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
  POLICY_AUD: 'aud-tag',
  OWNER_EMAIL: 'Owner@Example.com',
};

function request(token?: string) {
  return new Request('https://dofus-craft-admin.example.workers.dev/api/counters', {
    headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {},
  });
}

describe('owner verification (specs/014-admin-counters, FR-007)', () => {
  it('accepts a valid Access token carrying the owner address, whatever its case', async () => {
    const verify = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
    await expect(verifyOwner(request('jwt'), env, verify)).resolves.toEqual({ ok: true, email: 'owner@example.com' });
    expect(verify).toHaveBeenCalledWith('jwt', 'https://dofus.cloudflareaccess.com', 'aud-tag');
  });

  it.each([
    ['TEAM_DOMAIN', { ...env, TEAM_DOMAIN: '' }],
    ['POLICY_AUD', { ...env, POLICY_AUD: '' }],
    ['OWNER_EMAIL', { ...env, OWNER_EMAIL: undefined }],
  ])('refuses everything while %s is not configured', async (_name, partialEnv) => {
    const verify = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
    await expect(verifyOwner(request('jwt'), partialEnv, verify)).resolves.toMatchObject({ ok: false });
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuses a request without an Access token', async () => {
    const verify = vi.fn();
    await expect(verifyOwner(request(), env, verify)).resolves.toMatchObject({ ok: false });
    expect(verify).not.toHaveBeenCalled();
  });

  it('refuses a token that does not verify', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('signature verification failed'));
    await expect(verifyOwner(request('forged'), env, verify)).resolves.toMatchObject({ ok: false });
  });

  it('refuses a valid token for another address', async () => {
    const verify = vi.fn().mockResolvedValue({ email: 'someone@else.com' });
    await expect(verifyOwner(request('jwt'), env, verify)).resolves.toMatchObject({ ok: false });
  });

  it('refuses a valid token without an address', async () => {
    const verify = vi.fn().mockResolvedValue({});
    await expect(verifyOwner(request('jwt'), env, verify)).resolves.toMatchObject({ ok: false });
  });
});
