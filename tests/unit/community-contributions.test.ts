import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLocalContribution,
  clearLocalContributions,
  listLocalContributions,
} from '../../src/persistence/community-contributions';

describe('local community contribution record', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts empty', () => {
    expect(listLocalContributions()).toEqual([]);
  });

  it('makes an added contribution listable', () => {
    addLocalContribution({ id: 'c1', resourceId: 'r1', serverId: 's1' });

    expect(listLocalContributions()).toEqual([{ id: 'c1', resourceId: 'r1', serverId: 's1' }]);
  });

  it('accumulates multiple contributions and persists across a simulated reload', () => {
    addLocalContribution({ id: 'c1', resourceId: 'r1', serverId: 's1' });
    addLocalContribution({ id: 'c2', resourceId: 'r2', serverId: 's1' });

    expect(listLocalContributions()).toEqual([
      { id: 'c1', resourceId: 'r1', serverId: 's1' },
      { id: 'c2', resourceId: 'r2', serverId: 's1' },
    ]);
  });

  it('clears the record', () => {
    addLocalContribution({ id: 'c1', resourceId: 'r1', serverId: 's1' });
    clearLocalContributions();

    expect(listLocalContributions()).toEqual([]);
  });
});
