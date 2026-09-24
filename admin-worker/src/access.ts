import { createRemoteJWKSet, jwtVerify } from 'jose';

// specs/014-admin-counters (research §2): Cloudflare Access already blocks anyone but the owner
// before this Worker runs; every API call still re-checks the Access token and the address, as
// Cloudflare recommends, so a misconfigured or disabled Access policy can never open the API.
// ctx.access is not available here: Workers serving static assets don't receive it.
export type AccessEnv = { TEAM_DOMAIN?: string; POLICY_AUD?: string; OWNER_EMAIL?: string };
export type OwnerCheck = { ok: true; email: string } | { ok: false; reason: string };
export type TokenVerifier = (token: string, teamDomain: string, audience: string) => Promise<{ email?: unknown }>;

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export const verifyAccessToken: TokenVerifier = async (token, teamDomain, audience) => {
  let keys = keySets.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keys);
  }
  const { payload } = await jwtVerify(token, keys, { issuer: teamDomain, audience });
  return { email: payload.email };
};

export async function verifyOwner(request: Request, env: AccessEnv, verify: TokenVerifier = verifyAccessToken): Promise<OwnerCheck> {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD || !env.OWNER_EMAIL) return { ok: false, reason: 'Access is not configured' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, reason: 'Missing Access token' };
  let payload: { email?: unknown };
  try {
    payload = await verify(token, env.TEAM_DOMAIN, env.POLICY_AUD);
  } catch {
    return { ok: false, reason: 'Invalid Access token' };
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email || email !== env.OWNER_EMAIL.trim().toLowerCase()) return { ok: false, reason: 'Not the owner' };
  return { ok: true, email };
}
