/** specs/075-connexion-discord-site: why a login did not end in a session — a refusal on Discord, or a failure. */
export type LoginError = 'login-failed' | 'cancelled';

/** Reads `#session=…` or `#error=…`, left in the address by the Worker after the Discord login. */
export function parseLoginFragment(hash: string): { token?: string; error?: LoginError } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('session');
  if (token && /^[0-9a-f]{64}$/.test(token)) return { token };
  const error = params.get('error');
  if (error === 'cancelled') return { error };
  if (error) return { error: 'login-failed' };
  return {};
}
