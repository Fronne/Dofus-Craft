import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCapture, readPurchaseLinesFromText } from '../../src/services/capture-ocr';

// specs/025-rune-purchase-import (US5, FR-024): what the site proposes from a capture's text.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('tesseract.js');
});

describe('readPurchaseLinesFromText', () => {
  it('proposes the resource whose name matches exactly, or none', async () => {
    const reading = await readPurchaseLinesFromText('10 x [Rune Do Air] (15 868 kamas)\n10 x [Bois de Frêne] (2 400 kamas)\n10 x [Rune Do Alr] (15 868 kamas)');
    expect(reading.status).toBe('ok');
    if (reading.status !== 'ok') return;
    expect(reading.lines.map((line) => [line.itemName, line.resource?.id ?? null])).toEqual([
      ['Rune Do Air', '11663'],
      ['Bois de Frêne', '303'],
      ['Rune Do Alr', null],
    ]);
  });

  it('keeps identical lines separate: four lots bought give four lines', async () => {
    const reading = await readPurchaseLinesFromText(Array(4).fill('10 x [Rune Do Air] (15 868 kamas)').join('\n'));
    expect(reading.status === 'ok' && reading.lines).toHaveLength(4);
  });

  it('says so when the text has no purchase line', async () => {
    await expect(readPurchaseLinesFromText('Bienvenue sur Dofus !')).resolves.toEqual({ status: 'no-lines' });
  });
});

describe('readCapture', () => {
  it('refuses a file that is not an image', async () => {
    await expect(readCapture(new Blob(['texte'], { type: 'text/plain' }))).resolves.toEqual({ status: 'not-an-image' });
  });

  it('is unavailable, without throwing, when the image or the reading engine can\'t be loaded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')));
    await expect(readCapture(new Blob(['x'], { type: 'image/png' }))).resolves.toEqual({ status: 'unavailable' });
  });
});
