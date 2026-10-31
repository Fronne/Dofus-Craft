// Builds the artwork fixed behind the page, one file per Dofus theme (public/backgrounds/songe-fond-<theme>.webp),
// from Ankama's whole « Songe infini » illustration, which is not kept in the repository:
//   node scripts/recolor-page-art.mjs <chemin de l'image, 16:9>
// Per theme the stonework is tinted, the foliage takes the Dofus' colors, so do the six little Dofus on
// their pedestals, and the Dofus logo of the bottom-right corner is erased. The emerald keeps its colors,
// except for the little Dofus, which turn green.
// sharp is not a declared dependency: it is the copy wrangler installs. Run "npm i -D sharp" if it goes missing.
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.join('public', 'backgrounds');

// `rotate` / `saturate` are the values the CSS filter had. `grass` and `orb` give the target hue
// (degrees) and saturation; the foliage keeps its own light and dark (lightness ×), the orb pulls its
// lightness toward the given one.
const THEMES = [
  { id: 'emeraude', orb: { h: 76, s: 0.68, l: 0.56 } },
  { id: 'pourpre', rotate: 132, saturate: 1.1, grass: { h: 8, s: 0.62, l: 1.15 }, orb: { h: 14, s: 0.78, l: 0.58 } },
  { id: 'turquoise', rotate: -35, saturate: 1, grass: { h: 176, s: 0.66, l: 1.2 }, orb: { h: 176, s: 0.72, l: 0.58 } },
  { id: 'ocre', rotate: -35, saturate: 1, grass: { h: 42, s: 0.72, l: 1.25 }, orb: { h: 44, s: 0.82, l: 0.6 } },
  { id: 'ebene', rotate: 140, saturate: 0.45, grass: { h: 350, s: 0.55, l: 0.85 }, orb: { h: 350, s: 0.7, l: 0.52 } },
  { id: 'ivoire', rotate: -26, saturate: 0.6, grass: { h: 46, s: 0.25, l: 2.3 }, orb: { h: 42, s: 0.58, l: 0.78 } },
];

const smooth = (t) => { const c = Math.min(Math.max(t, 0), 1); return c * c * (3 - 2 * c); };

// CSS filter: hue-rotate(), then saturate(), both on sRGB values.
function stoneTint(r, g, b, { rotate = 0, saturate = 1 }) {
  const a = rotate * Math.PI / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const hr = r * (0.213 + cos * 0.787 - sin * 0.213) + g * (0.715 - cos * 0.715 - sin * 0.715) + b * (0.072 - cos * 0.072 + sin * 0.928);
  const hg = r * (0.213 - cos * 0.213 + sin * 0.143) + g * (0.715 + cos * 0.285 + sin * 0.140) + b * (0.072 - cos * 0.072 - sin * 0.283);
  const hb = r * (0.213 - cos * 0.213 - sin * 0.787) + g * (0.715 - cos * 0.715 + sin * 0.715) + b * (0.072 + cos * 0.928 + sin * 0.072);
  const s = saturate;
  const sr = hr * (0.213 + 0.787 * s) + hg * (0.715 - 0.715 * s) + hb * (0.072 - 0.072 * s);
  const sg = hr * (0.213 - 0.213 * s) + hg * (0.715 + 0.285 * s) + hb * (0.072 - 0.072 * s);
  const sb = hr * (0.213 - 0.213 * s) + hg * (0.715 - 0.715 * s) + hb * (0.072 + 0.928 * s);
  return [sr, sg, sb].map((v) => Math.min(Math.max(v, 0), 255));
}

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

// 1 on the foliage, 0 on the blue-violet stone. The leaves are grey-green and barely saturated (0.04 to
// 0.09, hues 90 to 200); the stone is bluer (hue 210 and up) and clearly more saturated (0.12 and up).
// The dark leaves, the greyest ones and the little glowing cyan flowers (hue up to 200, quite saturated) count too.
function foliageWeight(h, s, l) {
  // The chroma (not the HSL saturation, which is large for any nearly white pixel) keeps the white noise out.
  const chromaValue = s * (1 - Math.abs(2 * l - 1));
  // The shaded leaves are blue-greys (hue up to 225, chroma under 0.065); the dark stone of those hues has a chroma of 0.1 and more.
  const greyish = 1 - smooth((chromaValue - 0.065) / 0.03);
  const hue = smooth((h - 70) / 20) * (1 - smooth((h - (200 + 25 * greyish)) / 20));
  const chroma = smooth((chromaValue - 0.008) / 0.025);
  return hue * chroma * smooth((l - 0.04) / 0.08) * (1 - smooth((l - 0.8) / 0.1));
}

const lerp = (a, b, t) => a + (b - a) * t;

// The foliage weight of every pixel, cleaned up: specks that are alone on the stone are dropped, and the holes inside a
// cluster of leaves (shadows, grey patches) are filled with the pixels that are not clearly stone. Right of the middle of
// the picture only the bright tufts count: the dark moss under the arch keeps its own colors.
async function foliageMask(data, width, height, scale) {
  const raw = Buffer.alloc(width * height);
  const loose = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const [h, s, l] = toHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
      const right = x / scale > 1000 ? smooth((l - 0.22) / 0.08) : 1;
      raw[p] = Math.round(255 * foliageWeight(h, s, l) * right);
      const chroma = s * (1 - Math.abs(2 * l - 1));
      loose[p] = Math.round(255 * (h < 225 ? 1 : 0) * (1 - smooth((chroma - 0.065) / 0.03)) * smooth((l - 0.04) / 0.08) * (1 - smooth((l - 0.8) / 0.1)) * right);
    }
  }
  const blurred = await sharp(raw, { raw: { width, height, channels: 1 } }).blur(2.5 * scale).extractChannel(0).raw().toBuffer();
  const mask = new Float32Array(width * height);
  for (let p = 0; p < mask.length; p += 1) {
    const around = blurred[p] / 255;
    const core = (raw[p] / 255) * smooth((around - 0.22) / 0.2);
    const fill = (loose[p] / 255) * smooth((around - 0.4) / 0.25);
    mask[p] = Math.max(core, fill);
  }
  return mask;
}

const fondSource = process.argv[2];
if (!fondSource) {
  console.error('Usage : node scripts/recolor-page-art.mjs <image source>');
  process.exit(1);
}
{
  const FOND_WIDTH = 3200;
  // The six little Dofus on their pedestals (pixels of the 2000 × 1125 artwork) and the Dofus logo of its
  // bottom-right corner, which is erased (the page's own colors show through there).
  const EGGS = [[768, 523], [1210, 503], [1262, 662], [730, 706], [713, 863], [1198, 820]];
  const EGG = { rx: 19, ry: 25 };
  const LOGO = { x: 1897, y: 1050, rx: 105, ry: 90 };
  const { data, info } = await sharp(fondSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / 2000;
  const foliage = await foliageMask(data, info.width, info.height, scale);
  const HALO = 0.32;
  const HALO_RADIUS = 46;
  const MAIN_EGG = 2;
  // 260 px of the 3200 px wide picture, in the 2000 px wide artwork.
  const SPRITE_RADIUS = 260 * 2000 / 3200;
  for (const theme of THEMES) {
    const others = THEMES.filter((other) => other !== theme);
    const eggThemes = EGGS.map((_, e) => (e === MAIN_EGG ? theme : others.shift()));
    const out = Buffer.from(data);
    const eggsOut = Buffer.alloc(out.length);
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const i = (y * info.width + x) * 4;
        const [r, g, b] = [out[i], out[i + 1], out[i + 2]];
        const [, , l] = toHsl(r, g, b);
        let color = stoneTint(r, g, b, theme);
        if (theme.grass) {
          const grass = fromHsl(theme.grass.h, theme.grass.s, Math.min(l * theme.grass.l, 0.9));
          color = color.map((v, k) => lerp(v, grass[k], foliage[i / 4]));
        }
        // Each little Dofus takes the color of one of the six primordial Dofus, with a faint halo of that
        // color around it. The one in the middle of the picture (the one the page lights up in the margin)
        // always has the theme's own color; the five others take the other themes' colors, in order.
        for (let e = 0; e < EGGS.length; e += 1) {
          const orbTheme = eggThemes[e];
          const [ex, ey] = EGGS[e];
          const away = Math.hypot((x / scale - ex) / EGG.rx, (y / scale - ey) / EGG.ry);
          const inside = 1 - smooth((away - 0.75) / 0.5);
          const halo = HALO * Math.exp(-((Math.hypot(x / scale - ex, y / scale - ey) / HALO_RADIUS) ** 2)) * (1 - inside);
          if (inside <= 0 && halo < 0.004) continue;
          const orb = fromHsl(orbTheme.orb.h, orbTheme.orb.s, Math.min(Math.max(lerp(l, orbTheme.orb.l, 0.55) + (l - 0.5) * 0.3, 0.12), 0.9));
          const glow = fromHsl(orbTheme.orb.h, orbTheme.orb.s, 0.62);
          color = color.map((v, k) => lerp(lerp(v, orb[k], inside), glow[k], halo));
        }
        // The six Dofus alone on a transparent picture, shown above the calm band (songe-oeufs): each one is cut
        // out with its pedestal as a soft oval and lit like a lamp, as the page does for the one in the margin.
        let weight = 0;
        let light = 0;
        for (const [ex, ey] of EGGS) {
          const distance = Math.hypot((x / scale - ex) / 0.92, y / scale - ey) / SPRITE_RADIUS;
          const bell = Math.exp(-((distance / 0.62) ** 2)) * (1 - smooth((distance - 0.78) / 0.22));
          if (bell > weight) {
            weight = bell;
            light = 0.32 + 0.6 * Math.exp(-((distance / 0.4) ** 2));
          }
        }
        if (weight > 0.002) {
          const [lh, ls, ll] = toHsl(...color);
          const lit = fromHsl(lh, Math.min(ls * 0.7, 1), Math.min(ll * light, 0.9));
          for (let k = 0; k < 3; k += 1) eggsOut[i + k] = Math.round(lit[k]);
          eggsOut[i + 3] = Math.round(255 * weight);
        }
        for (let k = 0; k < 3; k += 1) out[i + k] = Math.round(color[k]);
        const fromLogo = Math.hypot((x / scale - LOGO.x) / LOGO.rx, (y / scale - LOGO.y) / LOGO.ry);
        out[i + 3] = Math.round(255 * smooth((fromLogo - 0.7) / 1.6));
      }
    }
    await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
      .resize({ width: FOND_WIDTH, kernel: 'lanczos3' })
      .webp({ quality: 90, alphaQuality: 90, smartSubsample: true })
      .toFile(path.join(DIR, `songe-fond-${theme.id}.webp`));
    console.log(`songe-fond-${theme.id}.webp`);
    await sharp(eggsOut, { raw: { width: info.width, height: info.height, channels: 4 } })
      .resize({ width: FOND_WIDTH, kernel: 'lanczos3' })
      .webp({ quality: 96, alphaQuality: 100, smartSubsample: true })
      .toFile(path.join(DIR, `songe-oeufs-${theme.id}.webp`));
  }
}
