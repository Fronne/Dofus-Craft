import { describe, expect, it } from 'vitest';
import { infoMessageResponse } from '../../worker/src/info-message';
import { createTestD1 } from '../support/sqlite-d1';

// specs/020-info-banner, contracts/info-message-api.md « Public ».
const NOW = new Date('2026-09-26T12:00:00.000Z');

function withMessage(endsAt: string | null) {
  const test = createTestD1();
  void test.d1.prepare("INSERT INTO info_message (id, text, tone, ends_at, updated_at) VALUES ('current', ?, ?, ?, ?)")
    .bind('Maintenance mardi', 'important', endsAt, '2026-09-26T10:00:00.000Z').run();
  return test.d1;
}

describe('GET /info-message (specs/020)', () => {
  it('answers null without a message', async () => {
    await expect(infoMessageResponse(createTestD1().d1, NOW)).resolves.toEqual({ status: 200, body: null });
  });

  it('returns an active message, with its version and nothing else', async () => {
    await expect(infoMessageResponse(withMessage(null), NOW)).resolves.toEqual({
      status: 200,
      body: { text: 'Maintenance mardi', tone: 'important', endsAt: null, version: '2026-09-26T10:00:00.000Z' },
    });
    await expect(infoMessageResponse(withMessage('2026-09-27T00:00:00.000Z'), NOW)).resolves.toMatchObject({
      body: { endsAt: '2026-09-27T00:00:00.000Z' },
    });
  });

  it('answers null once the end date has passed (FR-006)', async () => {
    await expect(infoMessageResponse(withMessage('2026-09-26T11:00:00.000Z'), NOW)).resolves.toEqual({ status: 200, body: null });
  });
});
