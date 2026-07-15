import { PALETTE, RGB, shade } from "./palette.js";

// Floyd–Steinberg quantization of RGBA pixel data to the enabled palette colors.
// Returns Int16Array of palette indices (0-39).
export function quantize(data, W, H, enabled, dither) {
  const idxs = [];
  for (let i = 0; i < PALETTE.length; i++) if (enabled[i]) idxs.push(i);
  if (idxs.length === 0) idxs.push(0);
  const buf = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = data[i * 4];
    buf[i * 3 + 1] = data[i * 4 + 1];
    buf[i * 3 + 2] = data[i * 4 + 2];
  }
  const grid = new Int16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      let best = idxs[0], bd = Infinity;
      for (const pi of idxs) {
        const [pr, pg, pb] = RGB[pi];
        const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
        if (d < bd) { bd = d; best = pi; }
      }
      grid[i] = best;
      if (dither) {
        const [pr, pg, pb] = RGB[best];
        const er = r - pr, eg = g - pg, eb = b - pb;
        const push = (xx, yy, f) => {
          if (xx < 0 || xx >= W || yy >= H) return;
          const j = (yy * W + xx) * 3;
          buf[j] += er * f; buf[j + 1] += eg * f; buf[j + 2] += eb * f;
        };
        push(x + 1, y, 7 / 16); push(x - 1, y + 1, 3 / 16);
        push(x, y + 1, 5 / 16); push(x + 1, y + 1, 1 / 16);
      }
    }
  }
  return grid;
}

// Procedural brick stud (fallback while the real textures load)
export function drawBrick(ctx, x, y, s, hex) {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(x, y + s - 1, s, 1);
  ctx.fillRect(x + s - 1, y, 1, s);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y, s, 1);
  if (s < 6) return;
  const cx = x + s / 2, cy = y + s / 2, r = s * 0.33;
  ctx.beginPath();
  ctx.arc(cx + s * 0.05, cy + s * 0.07, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
  const grad = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.45, r * 0.15, cx, cy, r);
  grad.addColorStop(0, shade(hex, 46));
  grad.addColorStop(0.7, hex);
  grad.addColorStop(1, shade(hex, -26));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

// Render a full grid. If textures (HTMLImageElement[40]) are loaded, use the
// real brand brick textures; otherwise draw procedurally.
export function renderGrid(ctx, grid, W, H, cell, textures) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grid[y * W + x];
      if (textures) ctx.drawImage(textures[v], x * cell, y * cell, cell, cell);
      else drawBrick(ctx, x * cell, y * cell, cell, PALETTE[v].hex);
    }
  }
}
