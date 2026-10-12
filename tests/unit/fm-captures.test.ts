import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/045-restore-production-worker (US4, contracts/api.md « Captures »): correcting the lines of a
// capture, only runes counting in what was spent, and names the reading got slightly wrong.
beforeEach(() => clearReadCache());

const frene = { name: 'Bois de Frêne', qty: 10, price: 2400 };
const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

type Line = { id: string; itemName: string; quantity: number; totalKamas: number; unitPriceKamas: number; originalQuantity: number; originalTotalKamas: number; corrected: boolean; priceStatus: string };
type Capture = { id: string; spentKamas: number; corrected: boolean; lines: Line[]; ignored: { itemName: string; quantity: number; totalKamas: number }[]; items: { itemName: string; corrected: boolean; readNames: string[] }[] };
type Detail = { totalKamas: number; items: { itemName: string; quantity: number; totalKamas: number; corrected: boolean }[]; sessions: { captures: Capture[] }[] };

async function setup(lines = [doAirLine], spent = 15868) {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  await fm.startSession('42');
  await fm.capture('42', spent, lines);
  const read = async () => (await fm.call('GET', '/fm/seances/channel-1', { token: cyril })).json() as Promise<Detail>;
  const capture = (await read()).sessions[0].captures[0];
  const correct = (body: unknown, token = cyril, captureId = capture.id) => fm.call('PUT', `/fm/captures/${captureId}/lines`, { token, body });
  return { fm, cyril, bob, read, capture, correct };
}

describe('PUT /fm/captures/{id}/lines', () => {
  it('corrects a line, keeps what was first read, and what was spent follows', async () => {
    const { fm, capture, correct } = await setup();
    const [line] = capture.lines;

    const response = await correct({ lines: [{ id: line.id, quantity: 8, totalKamas: 12000 }] });
    expect(response.status).toBe(200);
    const detail = await response.json() as Detail;
    expect(detail.totalKamas).toBe(12000);
    expect(detail.items).toMatchObject([{ itemName: 'Rune Do Air', quantity: 8, totalKamas: 12000, corrected: true }]);
    expect(detail.sessions[0].captures[0]).toMatchObject({ spentKamas: 12000, corrected: true });
    expect(detail.sessions[0].captures[0].lines[0]).toMatchObject({
      quantity: 8, totalKamas: 12000, unitPriceKamas: 1500, originalQuantity: 10, originalTotalKamas: 15868, corrected: true, priceStatus: 'recorded',
    });
    // The price the line shared is corrected with it, not shared a second time.
    expect(fm.query('SELECT amount_kamas FROM community_price_contributions')).toEqual([{ amount_kamas: 1500 }]);
  });

  it('is no longer a corrected line once put back to what was first read', async () => {
    const { capture, correct, read } = await setup();
    const [line] = capture.lines;
    await correct({ lines: [{ id: line.id, quantity: 8, totalKamas: 12000 }] });
    await correct({ lines: [{ id: line.id, quantity: 10, totalKamas: 15868 }] });

    const detail = await read();
    expect(detail.totalKamas).toBe(15868);
    expect(detail.sessions[0].captures[0]).toMatchObject({ spentKamas: 15868, corrected: false });
    expect(detail.sessions[0].captures[0].lines[0]).toMatchObject({ quantity: 10, totalKamas: 15868, corrected: false });
  });

  it('changes nothing for a line sent as it is', async () => {
    const { fm, capture, correct } = await setup();
    const [line] = capture.lines;
    expect((await correct({ lines: [{ id: line.id, quantity: 10, totalKamas: 15868 }] })).status).toBe(200);
    expect(fm.query('SELECT corrected_at, original_quantity FROM fm_purchase_lines')).toEqual([{ corrected_at: null, original_quantity: null }]);
  });

  it('withdraws a shared price that becomes an outlier, and shares it again once it no longer is', async () => {
    const { fm, capture, correct } = await setup();
    for (const deviceId of ['a', 'b', 'c']) fm.insert({ resourceId: '11663', amountKamas: 1587, createdAt: recent(1), deviceId });
    const [line] = capture.lines;
    const prices = () => fm.query<{ n: number }>("SELECT COUNT(*) AS n FROM community_price_contributions WHERE origin = 'bot'")[0].n;

    const outlier = await (await correct({ lines: [{ id: line.id, quantity: 2, totalKamas: 15868 }] })).json() as Detail;
    expect(outlier.sessions[0].captures[0].lines[0]).toMatchObject({ unitPriceKamas: 7934, priceStatus: 'outlier' });
    expect(prices()).toBe(0);

    const back = await (await correct({ lines: [{ id: line.id, quantity: 10, totalKamas: 15868 }] })).json() as Detail;
    expect(back.sessions[0].captures[0].lines[0]).toMatchObject({ unitPriceKamas: 1587, priceStatus: 'recorded' });
    expect(prices()).toBe(1);
  });

  it('refuses an invalid body, a line twice, or a line of another capture', async () => {
    const { fm, capture, correct } = await setup();
    const [line] = capture.lines;
    for (const body of [
      {}, { lines: [] }, { lines: [{ id: line.id, quantity: 0, totalKamas: 100 }] }, { lines: [{ id: line.id, quantity: 1, totalKamas: 0 }] },
      { lines: [{ id: line.id, quantity: 1.5, totalKamas: 100 }] },
      { lines: [{ id: line.id, quantity: 1, totalKamas: 100 }, { id: line.id, quantity: 2, totalKamas: 100 }] },
    ]) {
      expect((await correct(body)).status).toBe(400);
    }
    const foreign = await correct({ lines: [{ id: 'another-line', quantity: 1, totalKamas: 100 }] });
    expect([foreign.status, await foreign.json()]).toEqual([400, { error: 'every line must belong to this capture' }]);
    expect(fm.query('SELECT quantity, total_kamas FROM fm_purchase_lines')).toEqual([{ quantity: 10, total_kamas: 15868 }]);
  });

  it('answers another player\'s capture like an unknown one', async () => {
    const { bob, capture, correct } = await setup();
    const body = { lines: [{ id: capture.lines[0].id, quantity: 1, totalKamas: 100 }] };
    const refused = await correct(body, bob);
    expect(refused.status).toBe(404);
    expect(await refused.text()).toBe(await (await correct(body, bob, 'unknown')).text());
  });
});

describe('only runes count (specs/044)', () => {
  it('leaves what is not a rune out of the bot\'s spending, the totals and the lines to correct', async () => {
    const { fm, capture, correct, read } = await setup([doAirLine, frene], 18268);

    expect(capture).toMatchObject({ spentKamas: 15868, ignored: [{ itemName: 'Bois de Frêne', quantity: 10, totalKamas: 2400 }] });
    expect(capture.lines.map((line) => line.itemName)).toEqual(['Rune Do Air']);
    expect((await read()).items.map((item) => item.itemName)).toEqual(['Rune Do Air']);
    expect(fm.query('SELECT item_name, counted FROM fm_purchase_lines ORDER BY position')).toEqual([{ item_name: 'Rune Do Air', counted: 1 }, { item_name: 'Bois de Frêne', counted: 0 }]);
    // Its price is shared all the same.
    expect(fm.query('SELECT resource_id FROM community_price_contributions ORDER BY resource_id')).toEqual([{ resource_id: '11663' }, { resource_id: '303' }]);

    const [ignored] = fm.query<{ id: string }>('SELECT id FROM fm_purchase_lines WHERE counted = 0');
    expect((await correct({ lines: [{ id: ignored.id, quantity: 1, totalKamas: 100 }] })).status).toBe(400);
  });

  it('takes off the bot\'s count only the lines it counted: those above 1 000 kamas', async () => {
    const { capture } = await setup([doAirLine, { name: 'Bois de Frêne', qty: 2, price: 1000 }, { name: 'Coiffe du Bouftou', qty: 1, price: 1001 }], 16869);
    expect(capture.spentKamas).toBe(15868);
  });

  it('counts only the runes of a capture imported on the site', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    const response = await fm.call('POST', '/fm/imports', { token, body: { sharePrices: false, lines: [
      { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 },
      { itemName: 'Bois de Frêne', itemId: '303', quantity: 10, totalKamas: 2400 },
    ] } });
    expect(response.status).toBe(201);
    expect(fm.query('SELECT spent_kamas FROM fm_captures')).toEqual([{ spent_kamas: 15868 }]);
    expect(fm.query('SELECT counted, original_item_name FROM fm_purchase_lines ORDER BY position')).toEqual([{ counted: 1, original_item_name: null }, { counted: 0, original_item_name: null }]);
  });
});

describe('names the reading got slightly wrong (specs/038)', () => {
  it('recovers a name read without its accents or with the frame of the window, and keeps what was read', async () => {
    const { fm, capture } = await setup([
      { name: 'Rune Pa Re Feu', qty: 1, price: 5000 },
      { name: '[Rune Do Air', qty: 10, price: 15868 },
      { name: 'Rune Do Air]', qty: 10, price: 15868 },
    ], 36736);

    expect(fm.query('SELECT item_name, original_item_name, item_id, price_status FROM fm_purchase_lines ORDER BY position')).toEqual([
      { item_name: 'Rune Pa Ré Feu', original_item_name: 'Rune Pa Re Feu', item_id: expect.any(String), price_status: 'recorded' },
      { item_name: 'Rune Do Air', original_item_name: '[Rune Do Air', item_id: '11663', price_status: 'recorded' },
      { item_name: 'Rune Do Air', original_item_name: 'Rune Do Air]', item_id: '11663', price_status: 'recorded' },
    ]);
    expect(capture.items.find((item) => item.itemName === 'Rune Do Air')?.readNames.sort()).toEqual(['Rune Do Air]', '[Rune Do Air']);
    expect(capture.items.find((item) => item.itemName === 'Rune Pa Ré Feu')?.readNames).toEqual(['Rune Pa Re Feu']);
  });

  it('leaves a name it cannot tell unknown, still counted when it reads as a rune', async () => {
    const { fm, capture } = await setup([{ name: 'Rune Do Alr', qty: 10, price: 15868 }, { name: '[Coiffe du Bouftou', qty: 1, price: 600 }], 15868);
    expect(fm.query('SELECT item_name, original_item_name, price_status, counted FROM fm_purchase_lines ORDER BY position')).toEqual([
      { item_name: 'Rune Do Alr', original_item_name: null, price_status: 'unknown-item', counted: 1 },
      { item_name: '[Coiffe du Bouftou', original_item_name: null, price_status: 'unknown-item', counted: 0 },
    ]);
    expect(capture.spentKamas).toBe(15868);
  });
});
