// Builds the light the jet of the fountain throws on the page artwork, fixed behind the page, one file per Dofus
// theme (public/backgrounds/songe-fontaine-<theme>.webp), from the artwork of that theme (songe-fond-<theme>.webp,
// made by scripts/recolor-page-art.mjs):
//   node scripts/build-fountain-art.mjs
// Same placement as songe-oeufs-<theme>.webp (a full picture, transparent but for what is lit): the page shows it
// above the calm band, which otherwise sits over the picture. It is the artwork itself, cut out in a wide, soft
// band around the jet, with its shadows lifted as if the jet lit them (the jet keeps its own picture, as it is),
// and a very light halo in the theme's color over it.
// sharp is not a declared dependency: it is the copy wrangler installs. Run "npm i -D sharp" if it goes missing.
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join('public', 'backgrounds');

// Hue (degrees) and saturation of the primordial Dofus of each theme: the same as `orb` in recolor-page-art.mjs.
const THEMES = [
  { id: 'emeraude', h: 76, s: 0.68 },
  { id: 'pourpre', h: 14, s: 0.78 },
  { id: 'turquoise', h: 176, s: 0.72 },
  { id: 'ocre', h: 44, s: 0.82 },
  { id: 'ebene', h: 350, s: 0.7 },
  { id: 'ivoire', h: 42, s: 0.58 },
];

// The jet in the 2000 × 1125 artwork: its axis drifts a little to the right going down, and it narrows.
const AXIS = { top: 990, bottom: 1003 };
const HALF_WIDTH = { top: 30, bottom: 20 };
// The lit band: how far it reaches on each side of the axis (a soft gaussian), how much of the artwork shows
// through it at most, and how much the shadows are lifted (0 leaves them, 1 would turn them to white).
const BAND = { sigma: 160, opacity: 0.6, lift: 0.32 };
// The jet and its stone close by are shown in full, whatever the wide band does.
const CORE = { reach: 2.2, opacity: 0.75 };
// The halo in the theme's color: how far it reaches, how strong it is at most.
const HALO = { sigma: 120, opacity: 0.1 };

const lerp = (a, b, t) => a + (b - a) * t;

function toHsl(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

for (const theme of THEMES) {
  const { data, info } = await sharp(path.join(DIR, `songe-fond-${theme.id}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const scale = width / 2000;
  const glow = fromHsl(theme.h, theme.s, 0.6);
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const depth = y / scale / 1125;
    const axis = lerp(AXIS.top, AXIS.bottom, depth);
    const halfWidth = lerp(HALF_WIDTH.top, HALF_WIDTH.bottom, depth);
    for (let x = 0; x < width; x += 1) {
      const away = Math.abs(x / scale - axis);
      const band = BAND.opacity * Math.exp(-((away / BAND.sigma) ** 2));
      const core = CORE.opacity * Math.exp(-((away / (halfWidth * CORE.reach)) ** 2));
      const shown = Math.max(band, core);
      const halo = HALO.opacity * Math.exp(-((away / HALO.sigma) ** 2));
      const i = (y * width + x) * 4;
      const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
      // Shadows are lifted, lights are left: the darker a point, the more it gains, the more so near the axis.
      const lit = fromHsl(h, s, Math.min(l + (1 - l) * (1 - l) * BAND.lift * (shown / BAND.opacity), 0.95));
      const alpha = (shown * data[i + 3]) / 255;
      const total = alpha + halo * (1 - alpha);
      if (total < 0.002) continue;
      for (let k = 0; k < 3; k += 1) out[i + k] = Math.round((lit[k] * alpha + glow[k] * halo * (1 - alpha)) / total);
      out[i + 3] = Math.round(255 * total);
    }
  }
  await sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true })
    .toFile(path.join(DIR, `songe-fontaine-${theme.id}.webp`));
  console.log(`songe-fontaine-${theme.id}.webp`);
}
