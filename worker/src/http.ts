import { cachedRead } from './read-cache';
import { CORS_HEADERS } from './cors';
import type { Env } from './index';

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

export function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization') ?? '';
  return header === `Bearer ${env.COMMUNITY_API_KEY}`;
}

// specs/021-background-data-loading: price reads go through the 60-second read cache.
export async function cachedJson(url: URL, read: () => Promise<{ status: number; body: unknown }>): Promise<Response> {
  const { status, body, headers } = await cachedRead(url, read);
  return json(body, status, headers);
}
