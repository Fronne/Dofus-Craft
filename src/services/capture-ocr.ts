import runeItems from '../data/rune-items.json';
import type { HdvItemsData } from '../domain/hdv';
import { buildResourceNameIndex, proposeLines, type ProposedLine, type ResourceNameIndex, type RuneItemsData } from '../domain/forgemagie';

// specs/025-rune-purchase-import (US5, research R9): reads a chat capture on the player's own device —
// the image is never sent anywhere (FR-025). Same preprocessing and same engine (Tesseract, French) as
// the Discord bot, so the site and Discord read captures alike. Tesseract.js is loaded only here, on
// the first import, never with the rest of the site.

export type CaptureReading =
  | { status: 'ok'; lines: ProposedLine[] }
  | { status: 'no-lines' }
  | { status: 'not-an-image' }
  | { status: 'unavailable' };

let resourceIndex: Promise<ResourceNameIndex> | undefined;

/** Runes and HDV resources by name; the HDV list is loaded on demand, like on the HDV page. */
export function loadResourceIndex(): Promise<ResourceNameIndex> {
  resourceIndex ??= import('../data/hdv-items.json').then((module) => {
    const hdv = module.default as HdvItemsData;
    return buildResourceNameIndex([...(runeItems as RuneItemsData).runes, ...hdv.items]);
  });
  return resourceIndex;
}

/** The part after the OCR: purchase lines, each with the resource its exact name designates. */
export async function readPurchaseLinesFromText(text: string): Promise<CaptureReading> {
  const lines = proposeLines(text, await loadResourceIndex());
  return lines.length > 0 ? { status: 'ok', lines } : { status: 'no-lines' };
}

// The bot's preprocessing (Botomoux preprocess_image): grayscale, ×3 enlargement, automatic contrast,
// then black and white at 150 — small digits are the first cause of misreadings (6/8, 0/8, 5/6).
const SCALE = 3;
const THRESHOLD = 150;

async function preprocess(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * SCALE;
  canvas.height = bitmap.height * SCALE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  let low = 255;
  let high = 0;
  for (let index = 0; index < data.length; index += 4) {
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    data[index] = gray;
    if (gray < low) low = gray;
    if (gray > high) high = gray;
  }
  const range = Math.max(high - low, 1);
  for (let index = 0; index < data.length; index += 4) {
    const stretched = ((data[index] - low) / range) * 255;
    const value = stretched > THRESHOLD ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export async function readCapture(file: Blob): Promise<CaptureReading> {
  if (!file.type.startsWith('image/')) return { status: 'not-an-image' };
  let text: string;
  try {
    const canvas = await preprocess(file);
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('fra');
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      text = (await worker.recognize(canvas)).data.text;
    } finally {
      await worker.terminate();
    }
  } catch {
    // Engine or language model that can't be loaded (offline, blocked CDN), unreadable image.
    return { status: 'unavailable' };
  }
  return readPurchaseLinesFromText(text);
}
