import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInfoMessage } from '../../src/services/info-message-api';

// specs/020-info-banner, contracts/info-message-api.md « Client ».
const MESSAGE = { text: 'Maintenance mardi', tone: 'important', endsAt: null, version: '2026-09-26T10:00:00.000Z' };

describe('getInfoMessage (specs/020)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the message from /info-message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(MESSAGE), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getInfoMessage()).resolves.toEqual(MESSAGE);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/info-message$/);
  });

  it.each([
    ['no message', () => Promise.resolve(new Response('null', { status: 200 }))],
    ['a 500 status', () => Promise.resolve(new Response('', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['invalid JSON', () => Promise.resolve(new Response('nope', { status: 200 }))],
    ['an unknown tone', () => Promise.resolve(new Response(JSON.stringify({ ...MESSAGE, tone: 'urgent' }), { status: 200 }))],
  ])('resolves undefined, without throwing, on %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));
    await expect(getInfoMessage()).resolves.toBeUndefined();
  });
});
