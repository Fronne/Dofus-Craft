import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServers } from '../../src/data/servers-repository';
import { clearCache } from '../../src/data/catalogue-cache';

beforeEach(() => {
  clearCache();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    total: 4,
    limit: 100,
    skip: 0,
    data: [
      { id: 1, gameTypeId: 0, name: { fr: 'Draconiros', en: 'Draconiros' } },
      { id: 2, gameTypeId: 0, name: { fr: 'Hell Mina', en: 'Hell Mina' } },
      { id: 3, gameTypeId: 3, name: { fr: 'Speed Rush 1', en: 'Speed Rush 1' } },
      { id: 4, gameTypeId: 0, name: { fr: 'Shukrute', en: '[!] Shukrute' } },
    ],
  }), { status: 200 }))));
});

describe('server list', () => {
  it('keeps only permanent servers, dropping event servers and flagged ones', async () => {
    const servers = await getServers();
    expect(servers.map((server) => server.name)).toEqual(['Draconiros', 'Hell Mina']);
  });

  it('gives every server a unique, url-safe, stable id derived from its French name', async () => {
    const servers = await getServers();
    const ids = servers.map((server) => server.id);
    expect(ids).toEqual(['draconiros', 'hell-mina']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
