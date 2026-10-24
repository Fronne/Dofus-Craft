// Cuts the two tall halves of the illustration shown beside the content column on wide screens
// (public/backgrounds/songe-gauche-<theme>.webp and songe-droite-<theme>.webp) out of the themed full
// artwork made by recolor-page-art.mjs (run that first):
//   node scripts/build-side-art.mjs
// It also cuts the little Dofus of the right half (songe-dofus-<theme>.webp), which the page puts back above
// the calm band so it stays in plain view.
// The fade on all four sides is baked into the file, so the page only has to place it and set its
// opacity — no CSS mask, which browsers do not all composite the same way.
// sharp is not a declared dependency: it is the copy wrangler installs. Run "npm i -D sharp" if it goes missing.
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join('public', 'backgrounds');
const THEMES = ['emeraude', 'pourpre', 'turquoise', 'ocre', 'ebene', 'ivoire'];

// `left` and `width` crop the artwork (fractions of its width), full height. `across` (from the outer
// edge to the edge next to the content column) and `down` are where each fade ends, starts again and
// ends, from 0 to 1. The right half stops short of the artwork's right edge, where the Dofus logo sits.
const HALVES = [
  { name: 'songe-gauche', left: 0, width: 0.316, innerEdge: 'right', across: [0.1, 0.62, 1], down: [0.04, 0.94, 1] },
  { name: 'songe-droite', left: 0.545, width: 0.316, innerEdge: 'left', across: [0.1, 0.62, 1], down: [0.04, 0.94, 1] },
];

// 0 → 1 → 1 → 0 along one axis, eased so the fade has no visible start.
function fade(position, fadeInEnd, fadeOutStart, fadeOutEnd) {
  const ease = (t) => t * t * (3 - 2 * t);
  if (position < fadeInEnd) return ease(position / fadeInEnd);
  if (position <= fadeOutStart) return 1;
  if (position >= fadeOutEnd) return 0;
  return ease(1 - (position - fadeOutStart) / (fadeOutEnd - fadeOutStart));
}

for (const theme of THEMES) {
  const source = path.join(DIR, `songe-fond-${theme}.webp`);
  const { width: sourceWidth, height } = await sharp(source).metadata();
  for (const half of HALVES) {
    const cropWidth = Math.round(sourceWidth * half.width);
    const cropLeft = Math.min(Math.round(sourceWidth * half.left), sourceWidth - cropWidth);

    const alpha = Buffer.alloc(cropWidth * height);
    for (let y = 0; y < height; y += 1) {
      const vertical = fade(y / height, ...half.down);
      for (let x = 0; x < cropWidth; x += 1) {
        const across = half.innerEdge === 'right' ? x / cropWidth : 1 - x / cropWidth;
        alpha[y * cropWidth + x] = Math.round(255 * vertical * fade(across, ...half.across));
      }
    }

    // The artwork has an alpha channel (its logo is erased): flatten it first, the fade is rebuilt here.
    const colors = await sharp(source)
      .extract({ left: cropLeft, top: 0, width: cropWidth, height })
      .removeAlpha()
      .modulate({ saturation: 0.85, brightness: 0.95 })
      .toBuffer();
    const output = path.join(DIR, `${half.name}-${theme}.webp`);
    await sharp(colors)
      .joinChannel(alpha, { raw: { width: cropWidth, height, channels: 1 } })
      .webp({ quality: 82, alphaQuality: 80 })
      .toFile(output);
    console.log(`${output} : ${cropWidth} × ${height}`);
  }
}

// Smooth 2D value noise between 0 and 1 (fixed lattice, so the result never changes between runs).
function valueNoise(x, y) {
  const lattice = (i, j) => {
    const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lattice(ix, iy) + (lattice(ix + 1, iy) - lattice(ix, iy)) * sx;
  const bottom = lattice(ix, iy + 1) + (lattice(ix + 1, iy + 1) - lattice(ix, iy + 1)) * sx;
  return top + (bottom - top) * sy;
}

// The little Dofus on its pedestal, at 1262 × 662 of the 2000 × 1125 artwork, cut out as a soft oval halo.
const EGG = { x: 1262 / 2000, y: 662 / 1125, radius: 260 };
for (const theme of THEMES) {
  const source = path.join(DIR, `songe-fond-${theme}.webp`);
  const { width, height } = await sharp(source).metadata();
  const size = EGG.radius * 2;
  const left = Math.round(width * EGG.x) - EGG.radius;
  const top = Math.round(height * EGG.y) - EGG.radius;
  const alpha = Buffer.alloc(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // A soft oval halo, a little taller than wide, falling off like a bell curve: no visible edge.
      // Only a slow, faint variation of the opacity keeps it from looking like a drawn shape.
      const distance = Math.hypot((x - EGG.radius) / 0.92, y - EGG.radius) / EGG.radius;
      const bell = Math.exp(-((distance / 0.62) ** 2));
      const cutoff = 1 - Math.min(Math.max((distance - 0.78) / 0.22, 0), 1);
      const drift = 0.92 + 0.08 * valueNoise(x / 60, y / 60);
      alpha[y * size + x] = Math.round(255 * bell * cutoff * drift);
    }
  }
  // The Dofus is a lamp: the stone around it is lit where it is close and falls back into the shade away
  // from it (brightness follows the distance), instead of being shown as it is in the picture.
  const { data: lit } = await sharp(source)
    .extract({ left, top, width: size, height: size })
    .removeAlpha()
    .modulate({ saturation: 1.15 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot((x - EGG.radius) / 0.92, y - EGG.radius) / EGG.radius;
      const light = 0.4 + 0.75 * Math.exp(-((distance / 0.4) ** 2));
      for (let k = 0; k < 3; k += 1) {
        const i = (y * size + x) * 3 + k;
        lit[i] = Math.min(255, Math.round(lit[i] * light));
      }
    }
  }
  const colors = lit;
  const output = path.join(DIR, `songe-dofus-${theme}.webp`);
  await sharp(colors, { raw: { width: size, height: size, channels: 3 } })
    .joinChannel(alpha, { raw: { width: size, height: size, channels: 1 } })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(output);
  console.log(`${output} : ${size} × ${size} at ${left},${top}`);
}
