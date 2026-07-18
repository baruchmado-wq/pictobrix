// ===== Retail kit mode: fixed 15-color palette + per-kit inventory =====
// Numbers come from the July-2026 simulation over a 270-image corpus
// (see the kit-color-simulation report). One kit = one 32x32 board + 1,200
// bricks. Buying N kits pools the inventory across the whole picture.
import { PALETTE, RGB } from "./palette.js";
import { quantize } from "./bricks.js";

// palette indices (0-based). 37-color mix (Baruch, July 2026): dropped 3
// near-duplicate pale colors after a 292-image usage audit — cyan #44D1E5,
// light-green #ABFFAA, light-purple #A285BD (each had a close cousin) — and
// moved those 45 bricks into 9 pure vivids (15->20) so they stop running out.
// Ordered by quantity (workhorses first) for the inventory display.
export const KIT_COLORS = [
  1, 3, 35,                                  // x100 grey, black, dark-brown(fan)
  4, 7, 16, 29, 30, 31, 32, 33, 36, 39,       // x50 skin/neutral family
  0, 2, 12, 15, 17, 18, 28, 37, 38,           // x25 secondary
  5, 6, 8, 9, 13, 19, 20, 21, 26, 34,         // x20 vivids + terracotta
  11, 22, 23, 25, 27,                          // x15 remaining (mint,navy,purple,pink,burgundy)
];

// bricks per color in ONE kit (sums to 1,300)
export const KIT_QTY = {
  1: 100, 3: 100, 35: 100,
  4: 50, 7: 50, 16: 50, 29: 50, 30: 50, 31: 50, 32: 50, 33: 50, 36: 50, 39: 50,
  0: 25, 2: 25, 12: 25, 15: 25, 17: 25, 18: 25, 28: 25, 37: 25, 38: 25,
  5: 20, 6: 20, 8: 20, 9: 20, 13: 20, 19: 20, 20: 20, 21: 20, 26: 20, 34: 20,
  11: 15, 22: 15, 23: 15, 25: 15, 27: 15,
};
export const KIT_TOTAL = 1300;

// board layouts available for N kits: all [w,h] with w*h === N (max side 8)
export function kitLayouts(n) {
  const out = [];
  for (let w = 1; w <= 8; w++) {
    if (n % w === 0) {
      const h = n / w;
      if (h >= 1 && h <= 8) out.push([w, h]);
    }
  }
  // closest-to-square first
  out.sort((a, b) => Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]));
  return out;
}

// ---- mild auto-levels: stretch 2..98 percentile luminance to 12..240 ----
// Mutates RGBA pixel data in place. Also used by the classic editor.
export function autoLevelsStretch(d) {
  const n = d.length / 4;
  const lum = new Float64Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const s = Float64Array.from(lum).sort();
  const p2 = s[Math.floor(0.02 * n)], p98 = s[Math.floor(0.98 * n)];
  if (p98 - p2 < 20) return; // near-flat image: leave alone
  const scale = (240 - 12) / (p98 - p2);
  for (let i = 0; i < d.length; i++) {
    if ((i & 3) === 3) continue; // skip alpha
    const v = (d[i] - p2) * scale + 12;
    d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
}

// perceptual-ish ("redmean") squared distance to a palette color
function pdist2(r, g, b, pi) {
  const p = RGB[pi];
  const rm = (r + p[0]) / 2, dr = r - p[0], dg = g - p[1], db = b - p[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

// chroma gate: a brick may not be much "louder" than the pixel it stands for.
// Kills vivid confetti on skin, skies and other near-neutral areas.
const CHROMA = RGB.map(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b));
const GATE = 55;
const gated = (pxChroma, pi) => CHROMA[pi] - pxChroma > GATE;

// ---- kit quantization ----
// 1. serpentine Floyd-Steinberg at a customer-set strength (0 = sharp flat
//    blocks / clearest; full strength reads as confetti at single-board scale)
// 2. inventory enforcement: overflow studs move to the cheapest in-stock
//    alternative, least-visible moves first
export const KIT_DITHER_DEFAULT = 0.35;

export function quantizeKit(data, W, H, allowed, budgets, strength = KIT_DITHER_DEFAULT) {
  const DITHER_STRENGTH = strength;
  const n = W * H;
  const buf = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    buf[i * 3] = data[i * 4];
    buf[i * 3 + 1] = data[i * 4 + 1];
    buf[i * 3 + 2] = data[i * 4 + 2];
  }
  const grid = new Int16Array(n);
  for (let y = 0; y < H; y++) {
    const ltr = y % 2 === 0;
    for (let k = 0; k < W; k++) {
      const x = ltr ? k : W - 1 - k;
      const i = y * W + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const pxChroma = Math.max(r, g, b) - Math.min(r, g, b);
      let best = -1, bd = Infinity;
      for (const pi of allowed) {
        if (gated(pxChroma, pi)) continue;
        const p = RGB[pi];
        const d = (r - p[0]) * (r - p[0]) + (g - p[1]) * (g - p[1]) + (b - p[2]) * (b - p[2]);
        if (d < bd) { bd = d; best = pi; }
      }
      if (best === -1) best = allowed[0]; // safety: gate can never empty a mix with neutrals
      grid[i] = best;
      const p = RGB[best];
      const er = (r - p[0]) * DITHER_STRENGTH, eg = (g - p[1]) * DITHER_STRENGTH, eb = (b - p[2]) * DITHER_STRENGTH;
      const dir = ltr ? 1 : -1;
      const push = (xx, yy, f) => {
        if (xx < 0 || xx >= W || yy >= H) return;
        const j = (yy * W + xx) * 3;
        buf[j] += er * f; buf[j + 1] += eg * f; buf[j + 2] += eb * f;
      };
      push(x + dir, y, 7 / 16); push(x - dir, y + 1, 3 / 16); push(x, y + 1, 5 / 16); push(x + dir, y + 1, 1 / 16);
    }
  }

  // ---- enforce budgets ----
  const need = {};
  for (const pi of allowed) need[pi] = 0;
  for (let i = 0; i < n; i++) need[grid[i]]++;
  const over = {}, cap = {};
  let overflow = 0;
  for (const pi of allowed) {
    over[pi] = Math.max(0, need[pi] - budgets[pi]);
    cap[pi] = Math.max(0, budgets[pi] - need[pi]);
    overflow += over[pi];
  }
  let substituted = 0;
  // lazy-greedy with a sorted candidate list; re-passes handle cap exhaustion
  for (let pass = 0; pass < 20 && overflow > 0; pass++) {
    const cands = [];
    for (let i = 0; i < n; i++) {
      const from = grid[i];
      if (over[from] <= 0) continue;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const pxChroma = Math.max(r, g, b) - Math.min(r, g, b);
      let alt = -1, ad = Infinity;
      for (const pj of allowed) {
        if (pj === from || cap[pj] <= 0) continue;
        if (gated(pxChroma, pj)) continue;
        const d = pdist2(r, g, b, pj);
        if (d < ad) { ad = d; alt = pj; }
      }
      if (alt === -1) { // gate left nothing in stock — allow anything in stock
        for (const pj of allowed) {
          if (pj === from || cap[pj] <= 0) continue;
          const d = pdist2(r, g, b, pj);
          if (d < ad) { ad = d; alt = pj; }
        }
      }
      if (alt !== -1) cands.push({ i, alt, extra: ad - pdist2(r, g, b, from) });
    }
    if (!cands.length) break;
    cands.sort((a, b) => a.extra - b.extra);
    for (const c of cands) {
      const from = grid[c.i];
      if (over[from] <= 0 || cap[c.alt] <= 0) continue; // stale: next pass
      grid[c.i] = c.alt;
      over[from]--; cap[c.alt]--; overflow--; substituted++;
      if (overflow === 0) break;
    }
  }
  return { grid, substituted };
}

// ---- classic mode: drop colors used in negligible amounts ----
// Re-quantizes without colors that ended below minCount (they add sorting work
// and a whole 100-brick bag for a handful of studs without changing the look).
export function quantizeMinCount(data, W, H, enabled, dither, minCount) {
  let en = [...enabled];
  const autoOff = new Set();
  let grid = quantize(data, W, H, en, dither);
  if (!minCount) return { grid, autoOff };
  for (let iter = 0; iter < 39; iter++) {
    const counts = new Array(PALETTE.length).fill(0);
    for (let i = 0; i < grid.length; i++) counts[grid[i]]++;
    const active = counts.filter((c) => c > 0).length;
    if (active <= 2) break;
    // drop the single lowest non-zero color under the threshold, then redo
    let low = -1, lowC = Infinity;
    for (let c = 0; c < counts.length; c++) {
      if (en[c] && counts[c] > 0 && counts[c] < minCount && counts[c] < lowC) { low = c; lowC = counts[c]; }
    }
    if (low === -1) break;
    en[low] = false;
    autoOff.add(low);
    grid = quantize(data, W, H, en, dither);
  }
  return { grid, autoOff };
}
