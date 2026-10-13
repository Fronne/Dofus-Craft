// Builds the two tall halves of the illustration shown beside the content column on wide screens
// (public/backgrounds/*.webp) from Ankama's « Songe infini » artwork, which is not kept in the repository:
//   node scripts/build-side-illustrations.mjs <chemin de l'image source, 16:9>
// The muted colors and the fade on all four sides are baked into the file, so the page only has
// to place it and set its opacity — no CSS mask, which browsers do not all composite the same way.
import path from 'node:path';
// sharp is not a declared dependency: it is the copy wrangler installs. Run `npm i -D sharp` if it goes missing.
import sharp from 'sharp';

const sourceFile = process.argv[2];
if (!sourceFile) {
  console.error('Usage : node scripts/build-side-illustrations.mjs <image source>');
  process.exit(1);
}

const MAX_HEIGHT = 2160;

// `left` and `width` crop the source (fractions of its width), full height. `across` (from the
// outer edge to the edge next to the content column) and `down` are where each fade ends, starts
// again and ends, from 0 to 1. `logo` is the ellipse of the wallpaper's logo, faded out on its own so
// the illustration can run lower than it.
const ILLUSTRATIONS = [
  { name: 'songe-gauche', left: 0, width: 0.316, innerEdge: 'right', across: [0.1, 0.62, 1], down: [0.04, 0.94, 1] },
  // Stops short of the source's right edge, where the Dofus logo sits.
  { name: 'songe-droite', left: 0.588, width: 0.316, innerEdge: 'left', across: [0.1, 0.62, 1], down: [0.04, 0.94, 1] },
];

// 0 → 1 → 1 → 0 along one axis, eased so the fade has no visible start.
function fade(position, fadeInEnd, fadeOutStart, fadeOutEnd) {
  const ease = (t) => t * t * (3 - 2 * t);
  if (position < fadeInEnd) return ease(position / fadeInEnd);
  if (position <= fadeOutStart) return 1;
  if (position >= fadeOutEnd) return 0;
  return ease(1 - (position - fadeOutStart) / (fadeOutEnd - fadeOutStart));
}

for (const illustration of ILLUSTRATIONS) {
  const source = sharp(sourceFile);
  const { width: sourceWidth, height: sourceHeight } = await source.metadata();
  const cropWidth = Math.round(sourceWidth * illustration.width);
  const cropLeft = Math.min(Math.round(sourceWidth * illustration.left), sourceWidth - cropWidth);
  const height = Math.min(sourceHeight, MAX_HEIGHT);
  const width = Math.round(cropWidth * height / sourceHeight);

  const alpha = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    const vertical = fade(y / height, ...illustration.down);
    for (let x = 0; x < width; x += 1) {
      const across = illustration.innerEdge === 'right' ? x / width : 1 - x / width;
      const { x: logoX, y: logoY, rx, ry } = illustration.logo ?? { x: -9, y: -9, rx: 1, ry: 1 };
      const fromLogo = Math.hypot((x / width - logoX) / rx, (y / height - logoY) / ry);
      const aroundLogo = fade(Math.min(Math.max((fromLogo - 1) / 0.8, 0), 1), 1, 1, 2);
      alpha[y * width + x] = Math.round(255 * vertical * aroundLogo * fade(across, ...illustration.across));
    }
  }

  // Cropped and resized first: sharp would otherwise run the resize after joining the channel.
  const colors = await source
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: sourceHeight })
    .resize(width, height)
    .modulate({ saturation: 0.6, brightness: 0.92 })
    .toBuffer();
  const output = path.join('public', 'backgrounds', `${illustration.name}.webp`);
  await sharp(colors)
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .webp({ quality: 82, alphaQuality: 80 })
    .toFile(output);
  console.log(`${output} : ${width} × ${height}`);
}
