import { describe, expect, it } from 'vitest';
import { listServers } from '../../src/domain/servers';

describe('server list', () => {
  it('is non-empty and includes at least two servers', () => {
    const servers = listServers();
    expect(servers.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every server a unique, non-empty, stable id', () => {
    const servers = listServers();
    const ids = servers.map((server) => server.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id.length).toBeGreaterThan(0));
  });

  it('gives every server a non-empty name', () => {
    listServers().forEach((server) => expect(server.name.length).toBeGreaterThan(0));
  });
});
